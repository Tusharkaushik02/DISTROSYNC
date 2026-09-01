import json
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api/v1/conversation"

def send_message(user_id: str, message: str):
    data = json.dumps({"user_id": user_id, "message": message}).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def test_validation():
    print("\n--- Test 0: Validation ---")
    # Missing user_id
    try:
        data = json.dumps({"message": "Hello"}).encode("utf-8")
        req = urllib.request.Request(BASE_URL, data=data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)
        assert False, "Should have failed with 422"
    except urllib.error.HTTPError as e:
        assert e.code == 422, f"Expected 422, got {e.code}"
        print("[PASS] Missing user_id correctly rejected with 422")

    # Empty user_id
    try:
        data = json.dumps({"user_id": "", "message": "Hello"}).encode("utf-8")
        req = urllib.request.Request(BASE_URL, data=data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req)
        assert False, "Should have failed with 422"
    except urllib.error.HTTPError as e:
        assert e.code == 422, f"Expected 422, got {e.code}"
        print("[PASS] Empty user_id correctly rejected with 422")

def test_basic_memory():
    print("\n--- Test 1: Basic Memory ---")
    user_id = "test_sourav_111"
    
    r1 = send_message(user_id, "My name is Sourav")
    print(f"User: My name is Sourav\nAI: {r1['response']}\n")
    
    r2 = send_message(user_id, "What is my name?")
    print(f"User: What is my name?\nAI: {r2['response']}\n")
    assert "sourav" in r2["response"].lower(), f"Expected name Sourav in response, got: {r2['response']}"
    print("[PASS] Basic memory test passed: AI remembered the name 'Sourav'")

def test_user_isolation():
    print("\n--- Test 2: User Isolation ---")
    user_a = "test_user_a_111"
    user_b = "test_user_b_222"
    
    r1 = send_message(user_a, "My name is Sourav")
    print(f"User A (111): My name is Sourav\nAI: {r1['response']}\n")
    
    r2 = send_message(user_b, "What is my name?")
    print(f"User B (222): What is my name?\nAI: {r2['response']}\n")
    assert "sourav" not in r2["response"].lower(), f"User B should not know name Sourav, got: {r2['response']}"
    print("[PASS] User isolation test passed: User B has no access to User A's history")

def test_multi_turn_context():
    print("\n--- Test 3: Multi-turn Context ---")
    user_id = "test_order_333"
    
    r1 = send_message(user_id, "I want to order mangoes")
    print(f"User: I want to order mangoes\nAI: {r1['response']}\n")
    
    r2 = send_message(user_id, "10 boxes")
    print(f"User: 10 boxes\nAI: {r2['response']}\n")
    
    r3 = send_message(user_id, "How many boxes of what fruit did I ask to order?")
    print(f"User: How many boxes of what fruit did I ask to order?\nAI: {r3['response']}\n")
    resp = r3["response"].lower()
    assert "10" in resp or "ten" in resp, f"Expected 10 in response, got: {r3['response']}"
    assert "mango" in resp, f"Expected mango in response, got: {r3['response']}"
    print("[PASS] Multi-turn context test passed: AI preserved full context across multiple turns")

if __name__ == "__main__":
    test_validation()
    test_basic_memory()
    test_user_isolation()
    test_multi_turn_context()
    print("\n========================================")
    print("ALL MILESTONE 2 TESTS PASSED SUCCESSFULLY!")
    print("========================================")
