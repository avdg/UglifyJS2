// workaround for tty output truncation upon process.exit()
[process.stdout, process.stderr].forEach(function(stream){
    if (stream._handle && stream._handle.setBlocking)
        stream._handle.setBlocking(true);
});

var path = require("path");
var fs = require("fs");

var FILES = exports.FILES = [
    "../lib/utils.js",
    "../lib/ast.js",
    "../lib/parse.js",
    "../lib/transform.js",
    "../lib/scope.js",
    "../lib/output.js",
    "../lib/compress.js",
    "../lib/sourcemap.js",
    "../lib/mozilla-ast.js",
    "../lib/propmangle.js",
    "../lib/minify.js",
    "./exports.js",
].map(function(file){
    return fs.realpathSync(path.join(path.dirname(__filename), file));
});

var UglifyJS = exports;

new Function("MOZ_SourceMap", "exports", "DEBUG", FILES.map(function(file){
    return fs.readFileSync(file, "utf8");
}).join("\n\n"))(
    require("source-map"),
    UglifyJS,
    !!global.UGLIFY_DEBUG
);

UglifyJS.AST_Node.warn_function = function(txt) {
    console.error("WARN: %s", txt);
};

UglifyJS.readFile = function(file) {
    return fs.readFileSync(file, "utf8");
};

// exports.describe_ast = function() {
//     function doitem(ctor) {
//         var sub = {};
//         ctor.SUBCLASSES.forEach(function(ctor){
//             sub[ctor.TYPE] = doitem(ctor);
//         });
//         var ret = {};
//         if (ctor.SELF_PROPS.length > 0) ret.props = ctor.SELF_PROPS;
//         if (ctor.SUBCLASSES.length > 0) ret.sub = sub;
//         return ret;
//     }
//     return doitem(UglifyJS.AST_Node).sub;
// }

exports.describe_ast = function() {
    var out = UglifyJS.OutputStream({ beautify: true });
    function doitem(ctor) {
        out.print("AST_" + ctor.TYPE);
        var props = ctor.SELF_PROPS.filter(function(prop){
            return !/^\$/.test(prop);
        });
        if (props.length > 0) {
            out.space();
            out.with_parens(function(){
                props.forEach(function(prop, i){
                    if (i) out.space();
                    out.print(prop);
                });
            });
        }
        if (ctor.documentation) {
            out.space();
            out.print_string(ctor.documentation);
        }
        if (ctor.SUBCLASSES.length > 0) {
            out.space();
            out.with_block(function(){
                ctor.SUBCLASSES.forEach(function(ctor, i){
                    out.indent();
                    doitem(ctor);
                    out.newline();
                });
            });
        }
    };
    doitem(UglifyJS.AST_Node);
    return out + "";
};

function readReservedFile(filename, reserved) {
    if (!reserved) {
        reserved = { vars: [], props: [] };
    }
    var data = fs.readFileSync(filename, "utf8");
    data = JSON.parse(data);
    if (data.vars) {
        data.vars.forEach(function(name){
            UglifyJS.push_uniq(reserved.vars, name);
        });
    }
    if (data.props) {
        data.props.forEach(function(name){
            UglifyJS.push_uniq(reserved.props, name);
        });
    }
    return reserved;
}

exports.readReservedFile = readReservedFile;

exports.readDefaultReservedFile = function(reserved) {
    return readReservedFile(path.join(__dirname, "domprops.json"), reserved);
};

exports.readNameCache = function(filename, key) {
    var cache = null;
    if (filename) {
        try {
            var cache = fs.readFileSync(filename, "utf8");
            cache = JSON.parse(cache)[key];
            if (!cache) throw "init";
            cache.props = UglifyJS.Dictionary.fromObject(cache.props);
        } catch(ex) {
            cache = {
                cname: -1,
                props: new UglifyJS.Dictionary()
            };
        }
    }
    return cache;
};

exports.writeNameCache = function(filename, key, cache) {
    if (filename) {
        var data;
        try {
            data = fs.readFileSync(filename, "utf8");
            data = JSON.parse(data);
        } catch(ex) {
            data = {};
        }
        data[key] = {
            cname: cache.cname,
            props: cache.props.toObject()
        };
        fs.writeFileSync(filename, JSON.stringify(data, null, 2), "utf8");
    }
};

// A file glob function that only supports "*" and "?" wildcards in the basename.
// Example: "foo/bar/*baz??.*.js"
// Argument `glob` may be a string or an array of strings.
// Returns an array of strings. Garbage in, garbage out.
exports.simple_glob = function simple_glob(glob) {
    var results = [];
    if (Array.isArray(glob)) {
        glob.forEach(function(elem) {
            results = results.concat(simple_glob(elem));
        });
        return results;
    }
    if (glob.match(/\*|\?/)) {
        var dir = path.dirname(glob);
        try {
            var entries = fs.readdirSync(dir);
        } catch (ex) {}
        if (entries) {
            var pattern = "^" + (path.basename(glob)
                .replace(/\(/g, "\\(")
                .replace(/\)/g, "\\)")
                .replace(/\{/g, "\\{")
                .replace(/\}/g, "\\}")
                .replace(/\[/g, "\\[")
                .replace(/\]/g, "\\]")
                .replace(/\+/g, "\\+")
                .replace(/\^/g, "\\^")
                .replace(/\$/g, "\\$")
                .replace(/\*/g, "[^/\\\\]*")
                .replace(/\./g, "\\.")
                .replace(/\?/g, ".")) + "$";
            var mod = process.platform === "win32" ? "i" : "";
            var rx = new RegExp(pattern, mod);
            for (var i in entries) {
                if (rx.test(entries[i]))
                    results.push(dir + "/" + entries[i]);
            }
        }
    }
    if (results.length === 0)
        results = [ glob ];
    return results;
};
