"use strict";

function parser($TEXT, options) {

    options = defaults(options, {
        strict         : false,
        filename       : null,
        toplevel       : null,
        expression     : false,
        html5_comments : true,
        bare_returns   : false,
        shebang        : true,
    });
    options.UglifyJS = exports;

    var parser = PEG.buildParser(GRAMMAR);

    var toplevel = parser.parse($TEXT, options);

    console.log(toplevel.start, toplevel.end)

    return toplevel;
}