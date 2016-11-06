exports.readFile = exports.simple_glob = exports.readNameCache =
    exports.writeNameCache = function() {
        throw Error("UglifyJS has no access to the file system");
    }

var minify = function(files, options) {
    options = defaults(options, {
        spidermonkey     : false,
        outSourceMap     : null,
        sourceRoot       : null,
        inSourceMap      : null,
        sourceMapUrl     : null,
        sourceMapInline  : false,
        fromString       : false,
        warnings         : false,
        mangle           : {},
        mangleProperties : false,
        nameCache        : null,
        output           : null,
        compress         : {},
        parse            : {}
    });
    base54.reset();

    // 1. parse
    var toplevel = null,
        sourcesContent = {};

    if (options.spidermonkey) {
        toplevel = AST_Node.from_mozilla_ast(files);
    } else {
        var addFile = function(file, fileUrl) {
            var code = options.fromString
                ? file
                : exports.readFile(file);
            sourcesContent[fileUrl] = code;
            toplevel = parse(code, {
                filename: fileUrl,
                toplevel: toplevel,
                bare_returns: options.parse ? options.parse.bare_returns : undefined
            });
        }
        if (!options.fromString) files = exports.simple_glob(files);
        [].concat(files).forEach(function (files, i) {
            if (typeof files === 'string') {
                addFile(files, options.fromString ? i : files);
            } else {
                for (var fileUrl in files) {
                    addFile(files[fileUrl], fileUrl);
                }
            }
        });
    }
    if (options.wrap) {
      toplevel = toplevel.wrap_commonjs(options.wrap, options.exportAll);
    }

    // 2. compress
    if (options.compress) {
        var compress = { warnings: options.warnings };
        merge(compress, options.compress);
        toplevel.figure_out_scope();
        var sq = Compressor(compress);
        toplevel = sq.compress(toplevel);
    }

    // 3. mangle properties
    if (options.mangleProperties || options.nameCache) {
        options.mangleProperties.cache = exports.readNameCache(options.nameCache, "props");
        toplevel = mangle_properties(toplevel, options.mangleProperties);
        exports.writeNameCache(options.nameCache, "props", options.mangleProperties.cache);
    }

    // 4. mangle
    if (options.mangle) {
        toplevel.figure_out_scope(options.mangle);
        toplevel.compute_char_frequency(options.mangle);
        toplevel.mangle_names(options.mangle);
    }

    // 5. output
    var inMap = options.inSourceMap;
    var output = {};
    if (typeof options.inSourceMap == "string") {
        inMap = JSON.parse(exports.readFile(options.inSourceMap));
    }
    if (options.outSourceMap || options.sourceMapInline) {
        output.source_map = SourceMap({
            file: options.outSourceMap,
            orig: inMap,
            root: options.sourceRoot
        });
        if (options.sourceMapIncludeSources) {
            for (var file in sourcesContent) {
                if (sourcesContent.hasOwnProperty(file)) {
                    output.source_map.get().setSourceContent(file, sourcesContent[file]);
                }
            }
        }

    }
    if (options.output) {
        merge(output, options.output);
    }
    var stream = OutputStream(output);
    toplevel.print(stream);


    var source_map = output.source_map;
    if (source_map) {
        source_map = source_map + "";
    }

    var mappingUrlPrefix = "\n//# sourceMappingURL=";
    if (options.sourceMapInline) {
        stream += mappingUrlPrefix + "data:application/json;charset=utf-8;base64," + new Buffer(source_map).toString("base64");
    } else if (options.outSourceMap && typeof options.outSourceMap === "string" && options.sourceMapUrl !== false) {
        stream += mappingUrlPrefix + (typeof options.sourceMapUrl === "string" ? options.sourceMapUrl : options.outSourceMap);
    }

    return {
        code : stream + "",
        map  : source_map
    };
};
