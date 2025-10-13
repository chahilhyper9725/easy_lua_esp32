// ═══════════════════════════════════════════════════════════
// Lua Standard Library - Autocomplete Definitions
// Complete Lua 5.x standard library with descriptions
// ═══════════════════════════════════════════════════════════

export const LUA_STDLIB_AUTOCOMPLETE = [
    // ═══════════════════════════════════════════════════════════
    // BASIC FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    {
        label: "assert",
        kind: "Function",
        insertText: "assert(${1:condition}, ${2:message})",
        documentation: "Raises an error if the condition is false. Optional error message can be provided.",
        detail: "assert(condition: any, message?: string): any"
    },
    {
        label: "error",
        kind: "Function",
        insertText: "error(${1:message})",
        documentation: "Terminates execution and displays an error message.",
        detail: "error(message: string, level?: number)"
    },
    {
        label: "print",
        kind: "Function",
        insertText: "print(${1:...})",
        documentation: "Prints values to the console, separated by tabs.",
        detail: "print(...: any)"
    },
    {
        label: "type",
        kind: "Function",
        insertText: "type(${1:value})",
        documentation: "Returns the type of a value as a string ('nil', 'number', 'string', 'boolean', 'table', 'function', 'thread', 'userdata').",
        detail: "type(value: any): string"
    },
    {
        label: "tonumber",
        kind: "Function",
        insertText: "tonumber(${1:value})",
        documentation: "Converts a value to a number. Returns nil if conversion fails.",
        detail: "tonumber(value: any, base?: number): number | nil"
    },
    {
        label: "tostring",
        kind: "Function",
        insertText: "tostring(${1:value})",
        documentation: "Converts a value to a string representation.",
        detail: "tostring(value: any): string"
    },
    {
        label: "pairs",
        kind: "Function",
        insertText: "pairs(${1:table})",
        documentation: "Returns an iterator for all key-value pairs in a table (unordered).",
        detail: "pairs(table: table): function"
    },
    {
        label: "ipairs",
        kind: "Function",
        insertText: "ipairs(${1:table})",
        documentation: "Returns an iterator for array portion of table (indices 1, 2, 3, ...).",
        detail: "ipairs(table: table): function"
    },
    {
        label: "next",
        kind: "Function",
        insertText: "next(${1:table}, ${2:key})",
        documentation: "Returns the next key-value pair in a table. Returns nil when no more pairs.",
        detail: "next(table: table, key?: any): any, any"
    },
    {
        label: "select",
        kind: "Function",
        insertText: "select(${1:index}, ${2:...})",
        documentation: "Returns all arguments after index. If index is '#', returns total number of arguments.",
        detail: "select(index: number | '#', ...: any): any"
    },
    {
        label: "pcall",
        kind: "Function",
        insertText: "pcall(${1:func}, ${2:...})",
        documentation: "Calls function in protected mode. Returns status (true/false) and result or error message.",
        detail: "pcall(func: function, ...: any): boolean, any"
    },
    {
        label: "xpcall",
        kind: "Function",
        insertText: "xpcall(${1:func}, ${2:errorHandler})",
        documentation: "Calls function with custom error handler in protected mode.",
        detail: "xpcall(func: function, errorHandler: function): boolean, any"
    },
    {
        label: "rawget",
        kind: "Function",
        insertText: "rawget(${1:table}, ${2:key})",
        documentation: "Gets value from table without invoking metamethods.",
        detail: "rawget(table: table, key: any): any"
    },
    {
        label: "rawset",
        kind: "Function",
        insertText: "rawset(${1:table}, ${2:key}, ${3:value})",
        documentation: "Sets value in table without invoking metamethods.",
        detail: "rawset(table: table, key: any, value: any): table"
    },
    {
        label: "rawequal",
        kind: "Function",
        insertText: "rawequal(${1:v1}, ${2:v2})",
        documentation: "Checks equality without invoking metamethods.",
        detail: "rawequal(v1: any, v2: any): boolean"
    },
    {
        label: "getmetatable",
        kind: "Function",
        insertText: "getmetatable(${1:object})",
        documentation: "Returns the metatable of an object, or nil if it has none.",
        detail: "getmetatable(object: any): table | nil"
    },
    {
        label: "setmetatable",
        kind: "Function",
        insertText: "setmetatable(${1:table}, ${2:metatable})",
        documentation: "Sets the metatable for a table. Returns the table.",
        detail: "setmetatable(table: table, metatable: table | nil): table"
    },
    {
        label: "collectgarbage",
        kind: "Function",
        insertText: "collectgarbage(${1:'collect'})",
        documentation: "Performs garbage collection operations ('collect', 'stop', 'restart', 'count', 'step').",
        detail: "collectgarbage(opt?: string, arg?: number): any"
    },

    // ═══════════════════════════════════════════════════════════
    // STRING LIBRARY
    // ═══════════════════════════════════════════════════════════
    {
        label: "string.byte",
        kind: "Function",
        insertText: "string.byte(${1:s}, ${2:i})",
        documentation: "Returns the numeric codes of characters at positions i to j.",
        detail: "string.byte(s: string, i?: number, j?: number): number..."
    },
    {
        label: "string.char",
        kind: "Function",
        insertText: "string.char(${1:...})",
        documentation: "Returns a string with characters having the given numeric codes.",
        detail: "string.char(...: number): string"
    },
    {
        label: "string.find",
        kind: "Function",
        insertText: "string.find(${1:s}, ${2:pattern})",
        documentation: "Searches for pattern in string. Returns start and end positions, or nil.",
        detail: "string.find(s: string, pattern: string, init?: number, plain?: boolean): number, number"
    },
    {
        label: "string.format",
        kind: "Function",
        insertText: "string.format(${1:formatstring}, ${2:...})",
        documentation: "Returns formatted string using printf-style formatting.",
        detail: "string.format(formatstring: string, ...: any): string"
    },
    {
        label: "string.gmatch",
        kind: "Function",
        insertText: "string.gmatch(${1:s}, ${2:pattern})",
        documentation: "Returns an iterator function that returns the next captures from pattern.",
        detail: "string.gmatch(s: string, pattern: string): function"
    },
    {
        label: "string.gsub",
        kind: "Function",
        insertText: "string.gsub(${1:s}, ${2:pattern}, ${3:repl})",
        documentation: "Replaces all occurrences of pattern with repl. Returns modified string and count.",
        detail: "string.gsub(s: string, pattern: string, repl: string | table | function, n?: number): string, number"
    },
    {
        label: "string.len",
        kind: "Function",
        insertText: "string.len(${1:s})",
        documentation: "Returns the length of string (equivalent to #s).",
        detail: "string.len(s: string): number"
    },
    {
        label: "string.lower",
        kind: "Function",
        insertText: "string.lower(${1:s})",
        documentation: "Converts string to lowercase.",
        detail: "string.lower(s: string): string"
    },
    {
        label: "string.upper",
        kind: "Function",
        insertText: "string.upper(${1:s})",
        documentation: "Converts string to uppercase.",
        detail: "string.upper(s: string): string"
    },
    {
        label: "string.match",
        kind: "Function",
        insertText: "string.match(${1:s}, ${2:pattern})",
        documentation: "Searches for first match of pattern in string. Returns captures or whole match.",
        detail: "string.match(s: string, pattern: string, init?: number): string..."
    },
    {
        label: "string.rep",
        kind: "Function",
        insertText: "string.rep(${1:s}, ${2:n})",
        documentation: "Returns string repeated n times.",
        detail: "string.rep(s: string, n: number, sep?: string): string"
    },
    {
        label: "string.reverse",
        kind: "Function",
        insertText: "string.reverse(${1:s})",
        documentation: "Returns string with characters in reverse order.",
        detail: "string.reverse(s: string): string"
    },
    {
        label: "string.sub",
        kind: "Function",
        insertText: "string.sub(${1:s}, ${2:i})",
        documentation: "Returns substring from position i to j (defaults to -1).",
        detail: "string.sub(s: string, i: number, j?: number): string"
    },

    // ═══════════════════════════════════════════════════════════
    // TABLE LIBRARY
    // ═══════════════════════════════════════════════════════════
    {
        label: "table.concat",
        kind: "Function",
        insertText: "table.concat(${1:list}, ${2:sep})",
        documentation: "Concatenates array elements into a string with separator.",
        detail: "table.concat(list: table, sep?: string, i?: number, j?: number): string"
    },
    {
        label: "table.insert",
        kind: "Function",
        insertText: "table.insert(${1:list}, ${2:value})",
        documentation: "Inserts element at end of array, or at specified position.",
        detail: "table.insert(list: table, pos?: number, value: any)"
    },
    {
        label: "table.remove",
        kind: "Function",
        insertText: "table.remove(${1:list}, ${2:pos})",
        documentation: "Removes element at position (default: last) and returns it.",
        detail: "table.remove(list: table, pos?: number): any"
    },
    {
        label: "table.sort",
        kind: "Function",
        insertText: "table.sort(${1:list}, ${2:comp})",
        documentation: "Sorts array in-place. Optional comparison function.",
        detail: "table.sort(list: table, comp?: function)"
    },
    {
        label: "table.unpack",
        kind: "Function",
        insertText: "table.unpack(${1:list})",
        documentation: "Returns all elements from array as separate values (also available as unpack()).",
        detail: "table.unpack(list: table, i?: number, j?: number): any..."
    },
    {
        label: "unpack",
        kind: "Function",
        insertText: "unpack(${1:list})",
        documentation: "Returns all elements from array as separate values (same as table.unpack).",
        detail: "unpack(list: table, i?: number, j?: number): any..."
    },

    // ═══════════════════════════════════════════════════════════
    // MATH LIBRARY
    // ═══════════════════════════════════════════════════════════
    {
        label: "math.abs",
        kind: "Function",
        insertText: "math.abs(${1:x})",
        documentation: "Returns absolute value of x.",
        detail: "math.abs(x: number): number"
    },
    {
        label: "math.acos",
        kind: "Function",
        insertText: "math.acos(${1:x})",
        documentation: "Returns arc cosine of x (in radians).",
        detail: "math.acos(x: number): number"
    },
    {
        label: "math.asin",
        kind: "Function",
        insertText: "math.asin(${1:x})",
        documentation: "Returns arc sine of x (in radians).",
        detail: "math.asin(x: number): number"
    },
    {
        label: "math.atan",
        kind: "Function",
        insertText: "math.atan(${1:x})",
        documentation: "Returns arc tangent of x (in radians).",
        detail: "math.atan(x: number): number"
    },
    {
        label: "math.atan2",
        kind: "Function",
        insertText: "math.atan2(${1:y}, ${2:x})",
        documentation: "Returns arc tangent of y/x (in radians), using signs to determine quadrant.",
        detail: "math.atan2(y: number, x: number): number"
    },
    {
        label: "math.ceil",
        kind: "Function",
        insertText: "math.ceil(${1:x})",
        documentation: "Returns smallest integer >= x.",
        detail: "math.ceil(x: number): number"
    },
    {
        label: "math.cos",
        kind: "Function",
        insertText: "math.cos(${1:x})",
        documentation: "Returns cosine of x (in radians).",
        detail: "math.cos(x: number): number"
    },
    {
        label: "math.deg",
        kind: "Function",
        insertText: "math.deg(${1:x})",
        documentation: "Converts angle from radians to degrees.",
        detail: "math.deg(x: number): number"
    },
    {
        label: "math.exp",
        kind: "Function",
        insertText: "math.exp(${1:x})",
        documentation: "Returns e^x.",
        detail: "math.exp(x: number): number"
    },
    {
        label: "math.floor",
        kind: "Function",
        insertText: "math.floor(${1:x})",
        documentation: "Returns largest integer <= x.",
        detail: "math.floor(x: number): number"
    },
    {
        label: "math.fmod",
        kind: "Function",
        insertText: "math.fmod(${1:x}, ${2:y})",
        documentation: "Returns remainder of x/y (floating point modulo).",
        detail: "math.fmod(x: number, y: number): number"
    },
    {
        label: "math.huge",
        kind: "Constant",
        insertText: "math.huge",
        documentation: "A value representing positive infinity.",
        detail: "math.huge: number"
    },
    {
        label: "math.log",
        kind: "Function",
        insertText: "math.log(${1:x})",
        documentation: "Returns natural logarithm of x. Optional base parameter.",
        detail: "math.log(x: number, base?: number): number"
    },
    {
        label: "math.max",
        kind: "Function",
        insertText: "math.max(${1:x}, ${2:...})",
        documentation: "Returns maximum value among arguments.",
        detail: "math.max(x: number, ...: number): number"
    },
    {
        label: "math.min",
        kind: "Function",
        insertText: "math.min(${1:x}, ${2:...})",
        documentation: "Returns minimum value among arguments.",
        detail: "math.min(x: number, ...: number): number"
    },
    {
        label: "math.modf",
        kind: "Function",
        insertText: "math.modf(${1:x})",
        documentation: "Returns integer part and fractional part of x.",
        detail: "math.modf(x: number): number, number"
    },
    {
        label: "math.pi",
        kind: "Constant",
        insertText: "math.pi",
        documentation: "Value of pi (3.14159...).",
        detail: "math.pi: number"
    },
    {
        label: "math.pow",
        kind: "Function",
        insertText: "math.pow(${1:x}, ${2:y})",
        documentation: "Returns x^y (same as x^y operator).",
        detail: "math.pow(x: number, y: number): number"
    },
    {
        label: "math.rad",
        kind: "Function",
        insertText: "math.rad(${1:x})",
        documentation: "Converts angle from degrees to radians.",
        detail: "math.rad(x: number): number"
    },
    {
        label: "math.random",
        kind: "Function",
        insertText: "math.random(${1:m}, ${2:n})",
        documentation: "Returns random number. No args: [0,1), one arg: [1,m], two args: [m,n].",
        detail: "math.random(m?: number, n?: number): number"
    },
    {
        label: "math.randomseed",
        kind: "Function",
        insertText: "math.randomseed(${1:x})",
        documentation: "Sets seed for random number generator.",
        detail: "math.randomseed(x: number)"
    },
    {
        label: "math.sin",
        kind: "Function",
        insertText: "math.sin(${1:x})",
        documentation: "Returns sine of x (in radians).",
        detail: "math.sin(x: number): number"
    },
    {
        label: "math.sqrt",
        kind: "Function",
        insertText: "math.sqrt(${1:x})",
        documentation: "Returns square root of x.",
        detail: "math.sqrt(x: number): number"
    },
    {
        label: "math.tan",
        kind: "Function",
        insertText: "math.tan(${1:x})",
        documentation: "Returns tangent of x (in radians).",
        detail: "math.tan(x: number): number"
    },

    // ═══════════════════════════════════════════════════════════
    // COROUTINE LIBRARY
    // ═══════════════════════════════════════════════════════════
    {
        label: "coroutine.create",
        kind: "Function",
        insertText: "coroutine.create(${1:func})",
        documentation: "Creates a new coroutine with function as body. Returns coroutine object.",
        detail: "coroutine.create(func: function): thread"
    },
    {
        label: "coroutine.resume",
        kind: "Function",
        insertText: "coroutine.resume(${1:co}, ${2:...})",
        documentation: "Starts or resumes coroutine execution. Returns status and values.",
        detail: "coroutine.resume(co: thread, ...: any): boolean, any..."
    },
    {
        label: "coroutine.running",
        kind: "Function",
        insertText: "coroutine.running()",
        documentation: "Returns running coroutine and boolean indicating if it's the main thread.",
        detail: "coroutine.running(): thread, boolean"
    },
    {
        label: "coroutine.status",
        kind: "Function",
        insertText: "coroutine.status(${1:co})",
        documentation: "Returns status of coroutine: 'running', 'suspended', 'normal', or 'dead'.",
        detail: "coroutine.status(co: thread): string"
    },
    {
        label: "coroutine.wrap",
        kind: "Function",
        insertText: "coroutine.wrap(${1:func})",
        documentation: "Creates a coroutine and returns function to resume it.",
        detail: "coroutine.wrap(func: function): function"
    },
    {
        label: "coroutine.yield",
        kind: "Function",
        insertText: "coroutine.yield(${1:...})",
        documentation: "Suspends execution of calling coroutine. Values are passed to resume.",
        detail: "coroutine.yield(...: any): any..."
    },

    // ═══════════════════════════════════════════════════════════
    // CONTROL STRUCTURES & KEYWORDS (snippets)
    // ═══════════════════════════════════════════════════════════
    {
        label: "if",
        kind: "Keyword",
        insertText: "if ${1:condition} then\n\t${2:-- code}\nend",
        documentation: "If statement",
        detail: "if condition then ... end"
    },
    {
        label: "if-else",
        kind: "Keyword",
        insertText: "if ${1:condition} then\n\t${2:-- true}\nelse\n\t${3:-- false}\nend",
        documentation: "If-else statement",
        detail: "if ... then ... else ... end"
    },
    {
        label: "if-elseif",
        kind: "Keyword",
        insertText: "if ${1:condition1} then\n\t${2:-- code1}\nelseif ${3:condition2} then\n\t${4:-- code2}\nelse\n\t${5:-- code3}\nend",
        documentation: "If-elseif-else statement",
        detail: "if ... elseif ... else ... end"
    },
    {
        label: "for",
        kind: "Keyword",
        insertText: "for ${1:i} = ${2:1}, ${3:10} do\n\t${4:-- code}\nend",
        documentation: "Numeric for loop",
        detail: "for i = start, end, step do ... end"
    },
    {
        label: "for-in",
        kind: "Keyword",
        insertText: "for ${1:k}, ${2:v} in ${3:pairs(table)} do\n\t${4:-- code}\nend",
        documentation: "Generic for loop (iterator)",
        detail: "for k, v in iterator do ... end"
    },
    {
        label: "while",
        kind: "Keyword",
        insertText: "while ${1:condition} do\n\t${2:-- code}\nend",
        documentation: "While loop",
        detail: "while condition do ... end"
    },
    {
        label: "repeat",
        kind: "Keyword",
        insertText: "repeat\n\t${1:-- code}\nuntil ${2:condition}",
        documentation: "Repeat-until loop",
        detail: "repeat ... until condition"
    },
    {
        label: "function",
        kind: "Keyword",
        insertText: "function ${1:name}(${2:args})\n\t${3:-- code}\nend",
        documentation: "Function definition",
        detail: "function name(args) ... end"
    },
    {
        label: "local function",
        kind: "Keyword",
        insertText: "local function ${1:name}(${2:args})\n\t${3:-- code}\nend",
        documentation: "Local function definition",
        detail: "local function name(args) ... end"
    },

    // ═══════════════════════════════════════════════════════════
    // KEYWORDS
    // ═══════════════════════════════════════════════════════════
    {
        label: "local",
        kind: "Keyword",
        insertText: "local ${1:var} = ${2:value}",
        documentation: "Declares local variable",
        detail: "local var = value"
    },
    {
        label: "return",
        kind: "Keyword",
        insertText: "return ${1:value}",
        documentation: "Returns value(s) from function",
        detail: "return value"
    },
    {
        label: "break",
        kind: "Keyword",
        insertText: "break",
        documentation: "Exits innermost loop",
        detail: "break"
    },
    {
        label: "true",
        kind: "Constant",
        insertText: "true",
        documentation: "Boolean true value",
        detail: "true"
    },
    {
        label: "false",
        kind: "Constant",
        insertText: "false",
        documentation: "Boolean false value",
        detail: "false"
    },
    {
        label: "nil",
        kind: "Constant",
        insertText: "nil",
        documentation: "Represents absence of value",
        detail: "nil"
    },
    {
        label: "and",
        kind: "Keyword",
        insertText: "and",
        documentation: "Logical AND operator",
        detail: "and"
    },
    {
        label: "or",
        kind: "Keyword",
        insertText: "or",
        documentation: "Logical OR operator",
        detail: "or"
    },
    {
        label: "not",
        kind: "Keyword",
        insertText: "not ",
        documentation: "Logical NOT operator",
        detail: "not"
    }
];
