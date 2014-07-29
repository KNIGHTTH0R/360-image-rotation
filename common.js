Function.prototype.scope = function () { 
    var argsOuter = Array.prototype.slice.call(arguments);
    var func = this;
    var scope = argsOuter[0];

    if (argsOuter.length > 1 && argsOuter[1] && !argsOuter[1].length)
        argsOuter = argsOuter.slice(1);
    else if (argsOuter[1] && argsOuter[1].length > 1)
        argsOuter = argsOuter[1];
    else
        argsOuter = [];

    var ret = function () {
        var args = Array.prototype.slice.call(arguments);
        args = argsOuter.concat(args);
        func.apply(scope, args);
    };
    return ret;
};

(function () {

    var evDispatcher = function (cback, e) {
        if (!e) e = window.event;
        cback.scope(this)(e);
    };

    listenOn = function (el, name, cb) {
        var ret;
        if (!el)
            return ret;
        if (el.attachEvent)
            ret = el.attachEvent("on" + name, evDispatcher.scope(el, cb.scope(el)));
        else if (el.addEventListener)
            ret = el.addEventListener(name, evDispatcher.scope(el, cb.scope(el)), false);

        return ret;
    };
})();
