Gateways
========

# API

## `getState()`

Get activity state.

- `id`: Activity id
- `type`: Activity type
- `entered`: The activity is entered, i.e. in a running state
- `pendingInbound`: List of pending inbound flows
- `discardedInbound`: List of discarded inbound flows
- `pendingOutbound`: List of pending outbound flows

## Input/Output

Defined input/output is supported by Exclusive and Inclusive gateways. The defined input is passed as input to outbound conditional flows.
