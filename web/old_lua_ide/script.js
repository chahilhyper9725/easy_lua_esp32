let editor;
let bleDevice;
let bleServer;
let nusService;
let txCharacteristic;
let rxCharacteristic;
let snippets = {};
let currentFileName = 'script.lua';
document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    loadApiDocs();
    setupEventListeners();
    loadSavedCode();
    makeApiDocsResizable();
    setupApiDocsSearch();
    adjustDebugConsoleSize();
    makeDebugConsoleResizable();
});




function initializeEditor() {

    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        // Define Lua language
        monaco.languages.register({ id: 'lua' });

        monaco.languages.setMonarchTokensProvider('lua', {
            defaultToken: '',
            tokenPostfix: '.lua',

            keywords: [
                'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if',
                'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while'
            ],

            operators: [
                '+', '-', '*', '/', '%', '^', '#', '==', '~=', '<=', '>=', '<', '>', '=',
                '(', ')', '{', '}', '[', ']', ';', ':', ',', '.', '..', '...'
            ],

            // we include these common regular expressions
            symbols: /[=><!~?:&|+\-*\/\^%]+/,
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

            // The main tokenizer for our languages
            tokenizer: {
                root: [
                    // identifiers and keywords
                    [/[a-zA-Z_]\w*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'identifier'
                        }
                    }],
                    // whitespace
                    { include: '@whitespace' },

                    // delimiters and operators
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>](?!@symbols)/, '@brackets'],
                    [/@symbols/, {
                        cases: {
                            '@operators': 'operator',
                            '@default': ''
                        }
                    }],

                    // numbers
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/0[xX][0-9a-fA-F]+/, 'number.hex'],
                    [/\d+/, 'number'],

                    // delimiter: after number because of .\d floats
                    [/[;,.]/, 'delimiter'],

                    // strings
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
                    [/'([^'\\]|\\.)*$/, 'string.invalid'],  // non-teminated string
                    [/"/, 'string', '@string."'],
                    [/'/, 'string', '@string.\''],
                ],

                whitespace: [
                    [/[ \t\r\n]+/, ''],
                    [/--.*$/, 'comment'],
                    [/--\[\[.*\]\]/, 'comment'],
                ],

                string: [
                    [/[^\\"']+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/["']/, {
                        cases: {
                            '$#==$S2': { token: 'string', next: '@pop' },
                            '@default': 'string'
                        }
                    }]
                ],
            },
        });


        monaco.languages.registerCompletionItemProvider('lua', {
            provideCompletionItems: function (model, position) {

                const suggestions = [
                    { label: 'pinMode', kind: monaco.languages.CompletionItemKind.Function, insertText: 'pinMode(${1:pin}, ${2:mode})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'digitalWrite', kind: monaco.languages.CompletionItemKind.Function, insertText: 'digitalWrite(${1:pin}, ${2:level})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'delay', kind: monaco.languages.CompletionItemKind.Function, insertText: 'delay(${1:ms})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'millis', kind: monaco.languages.CompletionItemKind.Function, insertText: 'millis()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'micros', kind: monaco.languages.CompletionItemKind.Function, insertText: 'micros()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_home', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_home()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_move', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_move(${1:position})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_speed', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_speed(${1:speedUs})--max=369 min=5000', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    { label: 'x_enable', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_enable()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_disable', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_disable()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_is_moving', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_is_moving()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_get_position', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_get_position()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_move_relative', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_move_relative(${1:distance})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'x_move_absolute', kind: monaco.languages.CompletionItemKind.Function, insertText: 'x_move_absolute(${1:position})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_home', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_home()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_move', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_move(${1:position}, ${2:takeShort}, ${3:blocking})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_speed', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_speed(${1:speedUs})--max=600 min=5000', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_accel', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_accel(${1:accelUs})--15000', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_enable', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_enable()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_disable', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_disable()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_is_moving', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_is_moving()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'y_get_position', kind: monaco.languages.CompletionItemKind.Function, insertText: 'y_get_position()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'buzzer_on', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_on()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'buzzer_off', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_off()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    { label: 'buzzer_set_state', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_set_state(${1:state})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'buzzer_beep', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_beep(${1:onTime}, ${2:offTime}, ${3:numBeeps})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'buzzer_beep_async', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_beep_async(${1:onTime}, ${2:offTime}, ${3:numBeeps})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'buzzer_stop', kind: monaco.languages.CompletionItemKind.Function, insertText: 'buzzer_stop()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_on', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_on()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_off', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_off()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_stop', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_stop()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    { label: 'laser_set_state', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_set_state(${1:state})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_set_power', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_set_power(${1:power})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_pulse', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_pulse(${1:onTime}, ${2:offTime}, ${3:numPulses})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'laser_pulse_async', kind: monaco.languages.CompletionItemKind.Function, insertText: 'laser_pulse_async(${1:onTime}, ${2:offTime}, ${3:numPulses})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_read', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_read()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_set_distance_tolerance', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_set_distance_tolerance(${1:distanceToleranceMtr})--min = 0.1 max = 0.5', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_set_flux_threshold', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_set_flux_threshold(${1:fluxThreshold})--min = 10 max = 100', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_tap', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_tap(${1:baseDistance}, ${2:baseFlux}, ${3:currentXmm})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_tap', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_tap(${1:baseDistance}, ${2:baseFlux}, ${3:currentXmm})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_tap_reset_block', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_tap_reset_block(${1:timeOut})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_long_reset_block', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_long_reset_block(${1:timeOut})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    { label: 'lidar_detect_long_press', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_long_press(${1:baseFlux}, ${2:fluxThreshold})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_reset', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_reset(${1:minDistance}, ${2:minFlux})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_detect_event', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_detect_event(${1:baseDistance}, ${2:baseFlux}, ${3:currentMM}, ${4:timeout})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_start', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_start()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_stop', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_stop()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_read_dis', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_read_dis()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'lidar_read_flux', kind: monaco.languages.CompletionItemKind.Function, insertText: 'lidar_read_flux()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'ble_print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'ble_print(${1:text})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'exit', kind: monaco.languages.CompletionItemKind.Function, insertText: 'exit()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'timeouteffect_start', kind: monaco.languages.CompletionItemKind.Function, insertText: 'timeouteffect_start(${1:timeout})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'timeouteffect_stop', kind: monaco.languages.CompletionItemKind.Function, insertText: 'timeouteffect_stop()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'timeouteffect_is_running', kind: monaco.languages.CompletionItemKind.Function, insertText: 'timeouteffect_is_running()', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    // Control Structures
                    { label: 'if', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if ${1:condition} then\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'if-else', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'if ${1:condition} then\n\t$2\nelse\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'elseif', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'elseif ${1:condition} then\n\t$0', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'for-numeric', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for ${1:i}=${2:1},${3:10},${4:1} do\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'for-in', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'for ${1:key},${2:value} in pairs(${3:table}) do\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'while', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'while ${1:condition} do\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'repeat-until', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'repeat\n\t$0\nuntil ${1:condition}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Table Operations
                    { label: 'table.insert', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.insert(${1:table}, ${2:value})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.remove', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.remove(${1:table}, ${2:index})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.concat', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.concat(${1:table}, ${2:separator})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.sort', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.sort(${1:table}, ${2:comp})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Common Lua Functions
                    { label: 'pairs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'pairs(${1:table})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'ipairs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'ipairs(${1:table})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'tonumber', kind: monaco.languages.CompletionItemKind.Function, insertText: 'tonumber(${1:e})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'tostring', kind: monaco.languages.CompletionItemKind.Function, insertText: 'tostring(${1:e})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'type', kind: monaco.languages.CompletionItemKind.Function, insertText: 'type(${1:v})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Math Functions
                    { label: 'math.abs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.abs(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.ceil', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.ceil(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.floor', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.floor(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.max', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.max(${1:x}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.min', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.min(${1:x}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.random', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.random(${1:m}, ${2:n})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.randomseed', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.randomseed(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // String Functions
                    { label: 'string.len', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.len(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.lower', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.lower(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.upper', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.upper(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.sub', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.sub(${1:s}, ${2:i}, ${3:j})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.format', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.format(${1:formatstring}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Function Definition
                    { label: 'function', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'function ${1:name}(${2:params})\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'local function', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'local function ${1:name}(${2:params})\n\t$0\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Variable Declaration
                    { label: 'local', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'local ${1:name} = ${2:value}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.abs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.abs(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.ceil', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.ceil(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.floor', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.floor(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.max', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.max(${1:x}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.min', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.min(${1:x}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.random', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.random(${1:m}, ${2:n})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.randomseed', kind: monaco.languages.CompletionItemKind.Function, insertText: 'math.randomseed(${1:x})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'math.pi', kind: monaco.languages.CompletionItemKind.Constant, insertText: 'math.pi' },

                    // Table Library
                    { label: 'table.insert', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.insert(${1:table}, ${2:pos}, ${3:value})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.remove', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.remove(${1:table}, ${2:pos})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.sort', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.sort(${1:table}, ${2:comp})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'table.concat', kind: monaco.languages.CompletionItemKind.Function, insertText: 'table.concat(${1:table}, ${2:sep}, ${3:i}, ${4:j})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // String Library
                    { label: 'string.len', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.len(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.lower', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.lower(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.upper', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.upper(${1:s})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.sub', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.sub(${1:s}, ${2:i}, ${3:j})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'string.format', kind: monaco.languages.CompletionItemKind.Function, insertText: 'string.format(${1:formatstring}, ${2:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // CJSON Library
                    { label: 'cjson.encode', kind: monaco.languages.CompletionItemKind.Function, insertText: 'cjson.encode(${1:value})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'cjson.decode', kind: monaco.languages.CompletionItemKind.Function, insertText: 'cjson.decode(${1:json})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Control Structures
                    { label: 'for numerical', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for ${1:i} = ${2:1}, ${3:10}, ${4:1} do\n\t${5:-- body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'for generic', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'for ${1:k}, ${2:v} in ${3:pairs}(${4:table}) do\n\t${5:-- body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'while', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'while ${1:condition} do\n\t${2:-- body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'repeat', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'repeat\n\t${1:-- body}\nuntil ${2:condition}', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'if', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if ${1:condition} then\n\t${2:-- body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'if-else', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'if ${1:condition} then\n\t${2:-- body}\nelse\n\t${3:-- else body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'function', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'function ${1:name}(${2:...})\n\t${3:-- body}\nend', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },

                    // Basic Lua Functions
                    { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print(${1:...})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'type', kind: monaco.languages.CompletionItemKind.Function, insertText: 'type(${1:var})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'tonumber', kind: monaco.languages.CompletionItemKind.Function, insertText: 'tonumber(${1:e})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'tostring', kind: monaco.languages.CompletionItemKind.Function, insertText: 'tostring(${1:e})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'pairs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'pairs(${1:t})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                    { label: 'ipairs', kind: monaco.languages.CompletionItemKind.Function, insertText: 'ipairs(${1:t})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }


                ];


                const wordRegex = /[a-zA-Z_]\w*/g;
                const content = model.getValue();
                const words = new Set(content.match(wordRegex) || []);
                words.forEach(word => {
                    if (!suggestions.some(s => s.label === word)) {
                        suggestions.push({
                            label: word,
                            kind: monaco.languages.CompletionItemKind.Text,
                            insertText: word
                        });
                    }
                });


                return { suggestions: suggestions };
            }
        });
        // Initialize editor
        const savedCode = localStorage.getItem('luaCode');

        editor = monaco.editor.create(document.getElementById('editor'), {
            value: savedCode,
            language: 'lua',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            renderIndentGuides: true,
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoIndent: 'full'
        });
        editor.onDidChangeCursorPosition(updateCursorPosition);
        editor.onDidChangeModelContent(saveCodeToLocalStorage);
        editor.onDidChangeModelContent(saveCodeToLocalStorage);
        loadSnippets();

        // editor.onDidChangeCursorPosition(updateCursorPosition);
    });

}
// window.addEventListener('resize', function() {
//     editor.layout();
// });


// function loadSavedCode() {
//     const savedCode = localStorage.getItem('luaCode');
//     if (savedCode) {
//         // monaco.editor.getModels()[0].setValue(savedCode);
//         console.log(savedCode);
//     }
// }

// function saveCodeToLocalStorage() {
//     const code = editor.getValue();
//     localStorage.setItem('luaCode', code);
//     saveFileName(); // Save the file name whenever the code is saved

// }

function updateCursorPosition(e) {
    const position = e.position;
    document.getElementById('cursorPosition').textContent = `Line: ${position.lineNumber}, Column: ${position.column}`;
}

// function loadApiDocs() {
//     fetch('api_docs.md')
//         .then(response => response.text())
//         .then(text => {
//             document.getElementById('apiDocs').innerHTML = marked(text);
//             // document.getElementById('apiDocs').innerHTML = text;
//         });
// }







function setupEventListeners() {
    document.getElementById('newFile').addEventListener('click', createNewFile);
    document.getElementById('openFile').addEventListener('click', openFile);
    document.getElementById('saveFile').addEventListener('click', saveFile);
    document.getElementById('connectBLE').addEventListener('click', connectBLE);
    document.getElementById('disconnectBLE').addEventListener('click', disconnectBLE);
    document.getElementById('executeCode').addEventListener('click', executeCode);
    document.getElementById('stopCode').addEventListener('click', stopCode);

    document.getElementById('debugToggle').addEventListener('click', toggleDebugConsole);
    document.getElementById('apiDocsToggle').addEventListener('click', toggleApiDocs);
    document.addEventListener('keydown', handleShortcuts);
    document.getElementById('copyConsole').addEventListener('click', copyConsoleContent);
    document.getElementById('clearConsole').addEventListener('click', clearDebugConsole);



    document.getElementById('snippetSelect').addEventListener('change', handleSnippetSelect);
    document.getElementById('saveSnippet').addEventListener('click', saveSnippet);
    document.getElementById('deleteSnippet').addEventListener('click', deleteSnippet);
    document.getElementById('exportSnippets').addEventListener('click', exportSnippets);
    document.getElementById('importSnippets').addEventListener('click', importSnippets);
    document.getElementById('fileName').addEventListener('input', updateFileName);
    document.getElementById('saveFile').addEventListener('click', saveFile);
    // document.getElementById('fileName').addEventListener('input', updateFileName);
    document.getElementById('fileName').addEventListener('blur', ensureFileExtension);
}


function copyConsoleContent() {
    const consoleContent = document.getElementById('debugConsole').innerText;
    navigator.clipboard.writeText(consoleContent).then(() => {
        log('Console content copied to clipboard');
    });
}


function handleShortcuts(event) {
    // Ctrl+Shift+S to stop execution
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        stopExecution();
    }
    // Ctrl+Enter to execute code
    if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        executeCode();
    }
    // Ctrl+Shift+Enter to run selected code
    if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        runSelectedCode();
    }
}

async function stopExecution() {
    if (!txCharacteristic) {
        log('Not connected to ESP32');
        return;
    }

let stopScript =snippets["stop.lua"];


    await sendString('\x01' + stopScript);
    // await sendString(stopScript);
    log('Execution stopped');
}

async function executeCode(code = null) {
    if (!txCharacteristic) {
        log('Not connected to ESP32');
        return;
    }

    if (document.getElementById('autoClear').checked) {
        clearDebugConsole();
    }

    // const codeToExecute = code || editor.getValue();
    const codeToExecute = editor.getValue();
    log('Executing code...');
    editor.updateOptions({ readOnly: true });

    try {
        await sendString(codeToExecute);
        await sendString('\x04');
        log('Code execution started');
    } catch (error) {
        console.error('Error sending code:', error);
        log('Error executing code: ' + error.message);
    } finally {
        editor.updateOptions({ readOnly: false });
    }
}

async function stopCode() {
    try {

//         let stopScript =
//             `
//     x_home()
//     y_home()
// x_disable()
// y_disable()
// lidar_stop()
// buzzer_beep(2000, 1000, 2)
// buzzer_stop()
// laser_stop()
//     `;
    let stopScript =snippets["stop"];
        await sendString('\x01' + stopScript);
        log('Code execution stopped');
    } catch (error) {
        console.error('Error stopping code:', error);
        log('Error stopping code: ' + error.message);
    }
}

void function clearConsole() {
    document.getElementById('console').innerHTML = '';
}

// async function executeCode(code = null) {
//     if (!txCharacteristic) {
//         log('Not connected to ESP32');
//         return;
//     }

//     if (document.getElementById('autoClear').checked) {
//         clearDebugConsole();
//     }

//     // const codeToExecute = code || editor.getValue();
//     const codeToExecute = editor.getValue();
//       sendString(codeToExecute)
//         .then(() => sendString('\x04'))
//         .catch(error => console.error('Error sending code:', error));
//     log('Code execution started');
// }

function runSelectedCode() {
    const selectedCode = editor.getSelection();
    if (selectedCode) {
        executeCode(selectedCode);
    } else {
        log('No code selected. Please select some code to run.');
    }
}




async function connectBLE() {
    try {
        log('Connecting...');
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },{ services: [0xbe05] }, { services: [0xae05] },{ services: [0xae06] },{ services: [0xae07] },{ services: [0xae08] },{ services: [0xae09] },{ services: [0xae10] }],
            optionalServices: ['generic_access'],
        });
        bleServer = await bleDevice.gatt.connect();
        nusService = await bleServer.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
        txCharacteristic = await nusService.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
        rxCharacteristic = await nusService.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
        await rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener('characteristicvaluechanged', handleRxCharacteristicValueChanged);

        updateConnectionStatus(true);
        log('Connected to ESP32');

        //turn on lua mode after 2 seconds
        setTimeout(turnOnLuaMode, 100);
        // turnOnLuaMode();
    } catch (error) {
        console.error('Error connecting to BLE device:', error);
        log('Failed to connect to ESP32: ' + error);
        updateConnectionStatus(false);
    }
}



async function turnOnLuaMode() {
    var data =
    {
        msgtyp: 'lua',
    }
    //send data
    //convert data to string
    data = JSON.stringify(data)
    await sendString(data);
    await sendString('\n');


}



function disconnectBLE() {
    if (bleDevice && bleDevice.gatt.connected) {
        bleDevice.gatt.disconnect();
        updateConnectionStatus(false);
        log('Disconnected from ESP32');
    }
}

function updateConnectionStatus(isConnected) {
    const connectButton = document.getElementById('connectBLE');
    const disconnectButton = document.getElementById('disconnectBLE');
    const statusElement = document.getElementById('connectionStatus');

    if (isConnected) {
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
        statusElement.classList.remove('disconnected');
        statusElement.classList.add('connected');
    } else {
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        statusElement.classList.remove('connected');
        statusElement.classList.add('disconnected');
    }

    const editorElement = document.getElementById('editor');
    if (isConnected) {
        editorElement.classList.add('connected');
    } else {
        editorElement.classList.remove('connected');
    }
}

let receivedData = '';

function handleRxCharacteristicValueChanged(event) {
    console.log(event);
    const value = event.target.value;
    console.log(value);
    const chunk = new TextDecoder().decode(value);
    receivedData += chunk;
    console.log(chunk);
    log(chunk);

}

function endline(receivedData) {
    const match = /\n/.exec(receivedData);
    if (match !== null) {
        return true;
    } else if (receivedData && receivedData[receivedData.length - 1] === '\n') {
        return true;
    }
    return false;
}

// function executeCode() {
//     if (!txCharacteristic) {
//         log('Not connected to ESP32');
//         return;
//     }

//     if (document.getElementById('autoClear').checked) {
//         clearDebugConsole();
//     }

//     const code = editor.getValue();
//     sendString(code)
//         .then(() => sendString('\x04'))
//         .catch(error => console.error('Error sending code:', error));
// }

async function sendString(str) {
    console.log(str);
    const encoder = new TextEncoder();
    const value = encoder.encode(str);
    const chunkSize = 480; // Adjust the chunk size as needed

    for (let i = 0; i < value.length; i += chunkSize) {
        const chunk = value.slice(i, i + chunkSize);
        await txCharacteristic.writeValueWithResponse(chunk);
    }
}

function log(message) {
    const debugConsole = document.getElementById('debugConsole');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');

    if (document.getElementById('timestamp').checked) {
        logEntry.textContent = `[${timestamp}] ${message}`;
    } else {
        logEntry.textContent = message;
    }

    debugConsole.appendChild(logEntry);
    debugConsole.scrollTop = debugConsole.scrollHeight;
}

function clearDebugConsole() {
    document.getElementById('debugConsole').innerHTML = '';
}

function toggleDebugConsole() {
    const debugContainer = document.querySelector('.debug-container');
    debugContainer.classList.toggle('collapsed');
}

function adjustDebugConsoleSize() {
    const debugContainer = document.querySelector('.debug-container');
    debugContainer.style.height = '30vh';  // Adjust this value as needed
}

// Call this function after the DOM is loaded


// Make the debug console resizable
function makeDebugConsoleResizable() {
    const debugContainer = document.querySelector('.debug-container');
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    debugContainer.appendChild(resizeHandle);

    let isResizing = false;
    let lastY;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = lastY - e.clientY;
        const newHeight = debugContainer.offsetHeight + delta;
        debugContainer.style.height = `${newHeight}px`;
        lastY = e.clientY;
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

// Call this function after the DOM is loaded


function toggleApiDocs() {
    const apiDocsContainer = document.querySelector('.api-docs-container');
    apiDocsContainer.classList.toggle('collapsed');
}


function makeApiDocsResizable() {
    const sidePanel = document.querySelector('.side-panel');
    const resizeHandle = document.querySelector('.resize-handle-vertical');
    let isResizing = false;
    let lastX;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastX = e.clientX;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = e.clientX - lastX;
        const newWidth = sidePanel.offsetWidth - delta;
        sidePanel.style.width = `${newWidth}px`;
        lastX = e.clientX;
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
    });
}

function setupApiDocsSearch() {
    const searchInput = document.getElementById('apiDocsSearch');
    const apiDocs = document.getElementById('apiDocs');

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const content = apiDocs.innerHTML;

        if (searchTerm.length > 2) {
            const highlightedContent = highlightSearchTerms(content, searchTerm);
            apiDocs.innerHTML = highlightedContent;
        } else {
            apiDocs.innerHTML = content.replace(/<mark class="search-highlight">(.*?)<\/mark>/g, '$1');
        }
    });
}

function highlightSearchTerms(content, searchTerm) {
    const regex = new RegExp(searchTerm, 'gi');
    return content.replace(regex, match => `<mark class="search-highlight">${match}</mark>`);
}

function loadApiDocs() {
    fetch('api_docs.md')
        .then(response => response.text())
        .then(text => {
            const apiDocsElement = document.getElementById('apiDocs');
            apiDocsElement.innerHTML = marked(text);
            setupApiDocsSearch(); // Call this after loading the content
        });
}
















function updateFileName(event) {
    currentFileName = event.target.value;
}

function ensureFileExtension() {
    let fileName = document.getElementById('fileName').value;
    if (fileName && !fileName.endsWith('.lua')) {
        fileName += '.lua';
        document.getElementById('fileName').value = fileName;
    }
    currentFileName = fileName;
}


function saveSnippet() {
    let name = document.getElementById('fileName').value;
    name = name.endsWith('.lua') ? name.slice(0, -4) : name;
    if (name) {
        snippets[name] = editor.getValue();
        localStorage.setItem('snippets', JSON.stringify(snippets));
        updateSnippetDropdown();
        document.getElementById('snippetSelect').value = name;
    }
}

function handleSnippetSelect() {
    const select = document.getElementById('snippetSelect');
    const name = select.value;
    if (name === 'new') {
        createNewFile();
    } else if (snippets[name]) {
        editor.setValue(snippets[name]);
        currentFileName = `${name}.lua`;
        document.getElementById('fileName').value = currentFileName;
    }
}

function createNewFile() {
    editor.setValue('');
    currentFileName = 'script.lua';
    document.getElementById('fileName').value = currentFileName;
    document.getElementById('snippetSelect').value = 'new';
}

function deleteSnippet() {
    const select = document.getElementById('snippetSelect');
    const name = select.value;
    if (name !== 'new' && confirm(`Are you sure you want to delete the snippet "${name}"?`)) {
        delete snippets[name];
        localStorage.setItem('snippets', JSON.stringify(snippets));
        updateSnippetDropdown();
        createNewFile();
    }
}

function updateSnippetDropdown() {
    const select = document.getElementById('snippetSelect');
    select.innerHTML = '<option value="new">Create New</option>';
    for (const name in snippets) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
}

function exportSnippets() {
    const data = JSON.stringify(snippets);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snippets.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importSnippets() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            try {
                const importedSnippets = JSON.parse(content);
                snippets = { ...snippets, ...importedSnippets };
                localStorage.setItem('snippets', JSON.stringify(snippets));
                updateSnippetDropdown();
                alert('Snippets imported successfully!');
            } catch (error) {
                alert('Error importing snippets. Please make sure the file is valid JSON.');
            }
        }
    }
    input.click();
}

function loadSavedCode() {
    const savedCode = localStorage.getItem('luaCode');
    if (savedCode && editor) {
        editor.setValue(savedCode);
    }
    loadFileName();
}

function loadFileName() {
    currentFileName = localStorage.getItem('fileName') || 'script.lua';
    document.getElementById('fileName').value = currentFileName;
}

function saveFileName() {
    localStorage.setItem('fileName', currentFileName);
}

function loadSnippets() {
    const savedSnippets = localStorage.getItem('snippets');
    if (savedSnippets) {
        snippets = JSON.parse(savedSnippets);

        updateSnippetDropdown();
    }
}

function saveCodeToLocalStorage() {
    const code = editor.getValue();
    localStorage.setItem('luaCode', code);
    saveFileName();
}

function saveFile() {
    const content = editor.getValue();
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = currentFileName;
    a.click();
    saveFileName();
}

function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lua';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            editor.setValue(content);
            //set current file name
            currentFileName = file.name;
            document.getElementById('fileName').value = currentFileName;
            saveFileName();
            saveSnippet();
      
        }
    }
    input.click();
}

