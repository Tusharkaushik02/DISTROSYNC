// Button action registry — centralized map of supported button actions
const BUTTON_ACTIONS = Object.freeze({
    track_order: {
        id: 'track_order',
        label: 'Track Order',
        enabled: true,
    },
    talk_to_human_sales: {
        id: 'talk_to_human_sales',
        label: 'Talk to Human / Sales',
        enabled: true,
    },
    cancel_order: {
        id: 'cancel_order',
        label: 'Cancel Order',
        enabled: true,
    },
    check_stock: {
        id: 'check_stock',
        label: 'Check Stock',
        enabled: true,
    },
});

// Reverse map: button label → action ID for Twilio ButtonText resolution
const LABEL_TO_ACTION = Object.freeze(
    Object.values(BUTTON_ACTIONS).reduce((map, action) => {
        map[action.label.toLowerCase()] = action.id;
        return map;
    }, {})
);

// Resolve button label or list ID to a registered action
function resolveButtonAction(buttonText, listId) {
    if (listId && BUTTON_ACTIONS[listId]) {
        return BUTTON_ACTIONS[listId];
    }

    if (buttonText) {
        const actionId = LABEL_TO_ACTION[buttonText.toLowerCase()];
        if (actionId) return BUTTON_ACTIONS[actionId];
    }

    return null;
}

// Stub action handlers — return pending_implementation for future ERP/AI wiring
function handleTrackOrder(canonicalEvent) {
    return {
        action: 'track_order',
        status: 'pending_implementation',
        data: { reason: 'ERP order tracking integration not implemented', sender: canonicalEvent.sender.phone },
    };
}

function handleTalkToHumanSales(canonicalEvent) {
    return {
        action: 'talk_to_human_sales',
        status: 'pending_implementation',
        data: { reason: 'Human handoff routing not implemented', sender: canonicalEvent.sender.phone },
    };
}

function handleCancelOrder(canonicalEvent) {
    return {
        action: 'cancel_order',
        status: 'pending_implementation',
        data: { reason: 'ERP order cancellation integration not implemented', sender: canonicalEvent.sender.phone },
    };
}

function handleCheckStock(canonicalEvent) {
    return {
        action: 'check_stock',
        status: 'pending_implementation',
        data: { reason: 'ERP stock query integration not implemented', sender: canonicalEvent.sender.phone },
    };
}

// Action ID → handler mapping
const ACTION_HANDLERS = Object.freeze({
    track_order: handleTrackOrder,
    talk_to_human_sales: handleTalkToHumanSales,
    cancel_order: handleCancelOrder,
    check_stock: handleCheckStock,
});

module.exports = {
    BUTTON_ACTIONS,
    LABEL_TO_ACTION,
    resolveButtonAction,
    ACTION_HANDLERS,
};
