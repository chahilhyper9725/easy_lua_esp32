--- Advanced LuaSys Example
-- Demonstrates complex task coordination, message passing, and patterns

local sys = require("sys")

print("\n=== LuaSys Advanced Example ===\n")

------------------------------------------ Producer/Consumer Pattern ------------------------------------------

-- Message queue simulation
local queue = {}
local QUEUE_SIZE = 5

-- Producer task
sys.taskInit(function()
    print("[Producer] Starting...")
    for i = 1, 20 do
        -- Wait if queue is full
        while #queue >= QUEUE_SIZE do
            print("[Producer] Queue full, waiting...")
            sys.wait(100)
        end

        -- Produce item
        table.insert(queue, {id = i, data = "Item_" .. i})
        print("[Producer] Produced: Item_" .. i .. " (queue size: " .. #queue .. ")")
        sys.publish("QUEUE_ITEM_AVAILABLE")

        -- Random production rate
        sys.wait(math.random(200, 800))
    end
    print("[Producer] Finished producing")
    sys.publish("PRODUCER_DONE")
end)

-- Consumer task
sys.taskInit(function()
    print("[Consumer] Starting...")
    local consumed = 0
    local target = 20

    while consumed < target do
        -- Wait for item or timeout
        if #queue == 0 then
            print("[Consumer] Queue empty, waiting for item...")
            sys.waitUntil("QUEUE_ITEM_AVAILABLE", 2000)
        end

        -- Consume item if available
        if #queue > 0 then
            local item = table.remove(queue, 1)
            consumed = consumed + 1
            print("[Consumer] Consumed: " .. item.data .. " (" .. consumed .. "/" .. target .. ")")

            -- Simulate processing time
            sys.wait(math.random(300, 700))
        end
    end

    print("[Consumer] Finished consuming all items")
end)

------------------------------------------ State Machine Example ------------------------------------------

local STATE_IDLE = 0
local STATE_RUNNING = 1
local STATE_PAUSED = 2
local STATE_STOPPED = 3

sys.taskInit(function()
    print("[StateMachine] Starting...")
    local state = STATE_IDLE
    local counter = 0

    while state ~= STATE_STOPPED do
        if state == STATE_IDLE then
            print("[StateMachine] IDLE - Waiting to start...")
            sys.waitUntil("SM_START")
            state = STATE_RUNNING
            counter = 0

        elseif state == STATE_RUNNING then
            counter = counter + 1
            print("[StateMachine] RUNNING - Counter: " .. counter)

            -- Check for messages with timeout
            local got_msg, msg = sys.waitUntil("SM_CONTROL", 1000)
            if got_msg then
                if msg == "PAUSE" then
                    state = STATE_PAUSED
                    print("[StateMachine] Transitioning to PAUSED")
                elseif msg == "STOP" then
                    state = STATE_STOPPED
                    print("[StateMachine] Transitioning to STOPPED")
                end
            end

        elseif state == STATE_PAUSED then
            print("[StateMachine] PAUSED - Waiting for RESUME or STOP...")
            local got_msg, msg = sys.waitUntil("SM_CONTROL")
            if msg == "RESUME" then
                state = STATE_RUNNING
                print("[StateMachine] Transitioning to RUNNING")
            elseif msg == "STOP" then
                state = STATE_STOPPED
                print("[StateMachine] Transitioning to STOPPED")
            end
        end
    end

    print("[StateMachine] State machine stopped")
end)

-- Controller task - sends commands to state machine
sys.taskInit(function()
    print("[Controller] Starting state machine controller...")

    sys.wait(1000)
    print("[Controller] Sending START command")
    sys.publish("SM_START")

    sys.wait(5000)
    print("[Controller] Sending PAUSE command")
    sys.publish("SM_CONTROL", "PAUSE")

    sys.wait(3000)
    print("[Controller] Sending RESUME command")
    sys.publish("SM_CONTROL", "RESUME")

    sys.wait(5000)
    print("[Controller] Sending STOP command")
    sys.publish("SM_CONTROL", "STOP")

    print("[Controller] Controller finished")
end)

------------------------------------------ Watchdog Pattern ------------------------------------------

local heartbeat_time = 0
local WATCHDOG_TIMEOUT = 3000

-- Worker task that sends heartbeats
sys.taskInit(function()
    print("[Worker] Starting with heartbeat...")
    for i = 1, 10 do
        -- Do some work
        print("[Worker] Working... iteration " .. i)
        sys.wait(500)

        -- Send heartbeat
        heartbeat_time = sys.timerIsActive and i or 0
        sys.publish("HEARTBEAT", i)
    end
    print("[Worker] Work completed")
end)

-- Watchdog task
sys.taskInit(function()
    print("[Watchdog] Starting watchdog monitor...")
    local last_heartbeat = 0

    while true do
        sys.wait(WATCHDOG_TIMEOUT)

        -- Check for heartbeat
        local got_msg = false
        repeat
            local result, seq = sys.waitUntil("HEARTBEAT", 0)
            if result then
                last_heartbeat = seq
                got_msg = true
                print("[Watchdog] Heartbeat received: " .. seq)
            end
        until not result

        if not got_msg then
            print("[Watchdog] WARNING: No heartbeat received!")
        end
    end
end)

------------------------------------------ Periodic Status Reporter ------------------------------------------

sys.timerLoopStart(function()
    print("\n--- Status Report ---")
    print("  Queue size: " .. #queue)
    print("  Memory: " .. collectgarbage("count") .. " KB")
    print("---------------------\n")
end, 10000)

print("\n=== All advanced tasks initialized ===\n")

-- Start event loop
sys.run()
