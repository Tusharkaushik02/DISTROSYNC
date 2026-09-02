import pytest
from app.core.exceptions import LLMResponseError
from app.intelligence.llm.response_parser import GroqResponseParser


class DummyChoice:
    def __init__(self, message):
        self.message = message


class DummyMessage:
    def __init__(self, content=None, tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls


class DummyToolCall:
    def __init__(self, id, name, arguments):
        self.id = id
        self.function = DummyFunction(name, arguments)


class DummyFunction:
    def __init__(self, name, arguments):
        self.name = name
        self.arguments = arguments


class DummyCompletion:
    def __init__(self, choices):
        self.choices = choices


class TestResponseParser:
    def setup_method(self):
        self.parser = GroqResponseParser()

    def test_parse_plain_text_response(self):
        msg = DummyMessage(content="Hello there!")
        comp = DummyCompletion([DummyChoice(msg)])

        res = self.parser.parse(comp)
        assert res.has_tool_calls is False
        assert res.content == "Hello there!"
        assert len(res.tool_calls) == 0

    def test_parse_tool_call_response(self):
        tc = DummyToolCall(
            id="call_123",
            name="search_products",
            arguments='{"query": "ABC123", "limit": 5}',
        )
        msg = DummyMessage(content=None, tool_calls=[tc])
        comp = DummyCompletion([DummyChoice(msg)])

        res = self.parser.parse(comp)
        assert res.has_tool_calls is True
        assert len(res.tool_calls) == 1
        assert res.tool_calls[0].name == "search_products"
        assert res.tool_calls[0].arguments == {"query": "ABC123", "limit": 5}
        assert res.tool_calls[0].id == "call_123"

    def test_parse_multiple_tool_calls(self):
        tc1 = DummyToolCall("c1", "search_products", '{"query": "P1"}')
        tc2 = DummyToolCall("c2", "get_inventory", '{"product_id": "uuid-1"}')
        msg = DummyMessage(content=None, tool_calls=[tc1, tc2])
        comp = DummyCompletion([DummyChoice(msg)])

        res = self.parser.parse(comp)
        assert res.has_tool_calls is True
        assert len(res.tool_calls) == 2
        assert res.tool_calls[0].name == "search_products"
        assert res.tool_calls[1].name == "get_inventory"

    def test_empty_choices_raises_error(self):
        comp = DummyCompletion([])
        with pytest.raises(LLMResponseError):
            self.parser.parse(comp)

    def test_empty_content_and_no_tools_raises_error(self):
        msg = DummyMessage(content="")
        comp = DummyCompletion([DummyChoice(msg)])
        with pytest.raises(LLMResponseError):
            self.parser.parse(comp)
