--- Basic LuaSys Example
-- Demonstrates sys.run, sys.taskInit, sys.wait, and timers

-- Load sys module (assumes it's already in package.path or embedded)
local sys = require("sys")

print("\n=== LuaSys Basic Example ===\n")

-- Task 1: Simple counter
sys.taskInit(function()
    print("[Task1] Starting counter task")
    for i = 1, 10 do
        print("[Task1] Count: " .. i)
        sys.wait(1000)  -- Wait 1 second
    end
    print("[Task1] Counter task completed")
end)

-- Task 2: Blink simulation
sys.taskInit(function()
    print("[Task2] Starting blink task")
    local state = false
    for i = 1, 20 do
        state = not state
        print("[Task2] LED state: " .. (state and "ON" or "OFF"))
        sys.wait(500)  -- Wait 500ms
    end
    print("[Task2] Blink task completed")
end)

-- Task 3: Publish/Subscribe demo
sys.taskInit(function()
    print("[Task3] Waiting for 'READY' message...")
    local result, data = sys.waitUntil("READY", 5000)
    if result then
        print("[Task3] Got READY message with data: " .. tostring(data))
    else
        print("[Task3] Timeout waiting for READY")
    end
end)

-- Task 4: Send READY message after 2 seconds
sys.taskInit(function()
    print("[Task4] Will send READY in 2 seconds...")
    sys.wait(2000)
    sys.publish("READY", "Hello from Task4!")
    print("[Task4] READY message sent")
end)

-- Timer example: Periodic callback (not a task)
local timer_count = 0
sys.timerLoopStart(function(msg)
    timer_count = timer_count + 1
    print("[Timer] Periodic callback #" .. timer_count .. " - " .. (msg or "no msg"))
end, 1500, "TimerData")

-- One-shot timer example
sys.timerStart(function()
    print("[Timer] One-shot timer fired after 3 seconds!")
end, 3000)

-- Memory info timer
sys.timerLoopStart(function()
    local total, used, max = rtos.meminfo()
    print(string.format("[MemInfo] Total: %d, Used: %d, Max: %d", total, used, max))
end, 5000)

print("\n=== All tasks initialized, starting event loop ===\n")

-- Start the event loop (this blocks forever)
sys.run()
