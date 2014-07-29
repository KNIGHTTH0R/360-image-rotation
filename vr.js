VR = Class.create();

VR.options = {
	imageIndexOffset: 1,        // (number)   maps the position [0,0] to image 001.jpg, etc.
	loaders: 3,                 // (number)   how many concurrent image loaders
	initialLoad: 4,             // (number)   images to load initially per row (4 = every 90 degrees)
	noCache: false,             // (boolean)  append a random query string to the image URLs?
	initialPos: [0,0],          // (mixed)    initial VR position (number or array)
	infiniteAxis: [true,false], // (array)    defines which axes can spin infinitely

	autoPlay: false,            // (boolean)  begin auto spin right away?
	fps: 25,                    // (number)   frames per second (used for the intro, auto spinning, and throwing)
	grabRotateDistance: 1000,   // (number)   pixels the cursor must travel to view a full axis

	throwable: true,            // (boolean)  does the VR have inertia when releasing a grab?
	minThrowDuration: 0.5,      // (number)   minimum throw duration in seconds
	maxThrowDuration: 1.5,      // (number)   maximum throw duration in seconds
	minSpinDuration: 3         // (number)   minimum time in seconds the VR will take to rotate 360 degrees
};

Object.extend(VR.prototype, {

    convertToArray: function (mixed, second) {
        return (typeof mixed[0] == 'undefined') ? [mixed, second] : mixed;
    },

    initialize: function (container, imagePath, hdImagePath, totalFrames, options) {

        // options
        this.options = Object.extend(Object.clone(VR.options), options);
        if (this.options.noCache)
            this.random = Math.floor(Math.random() * 10000000);
		
		this.detectedTouchEvent = false;

        // dom
        this.vr = $(container);

        // images
        this.imagePathParts = imagePath.match(/^([^#]*)(#+)([^#]*)$/);

        this.hdImagePathParts = hdImagePath.match(/^([^#]*)(#+)([^#]*)$/);

        this.numDigits = this.imagePathParts[2].length;

        // convert totalFrames and initialPos to x,y coordinates
        this.totalFrames = this.convertToArray(totalFrames, 1);
        
        this.frameMultipliers = [1, 1];
        
        this.options.initialPos = this.convertToArray(this.options.initialPos, 0);

        this.frames = [];
        for (var i = 0; i < this.totalFrames[0]; i++) {
            this.frames[i] = [];
        }

        // options conversions
        this.playIntervalDuration = 1000 / this.options.fps;
        this.minSpinIntervalDuration = (this.options.minSpinDuration * 1000) / this.totalFrames[0];
        this.minThrowFrames = Math.floor(this.options.minThrowDuration * this.options.fps);
        this.maxThrowFrames = Math.floor(this.options.maxThrowDuration * this.options.fps);

        // state
        this.currentPos;
        this.playing = false;
        this.grabbing = false;

        this.zoomr = null;

        this.img = null;

        if (this.options.autoPlay)
            this.currentMode = global_mode_auto_rotate;
        else
            this.currentMode = global_mode_manual_rotate;

        this.loadAllFrames();
        this.gotoPos(this.options.initialPos);
        this.makeInteractive();

        // auto play?
        if (this.options.autoPlay) {
            this.play();
        }
    },
	
	setMode : function(mode) {
		
		if(mode == global_mode_auto_rotate) {
			document.btnAutoRot.src='common/icons/auto_rotate_down.png';
			document.btnManualRot.src='common/icons/manual_rotate_up.png';
			document.btnMagnifier.src='common/icons/enlarge_up.png';
		} else if(mode == global_mode_manual_rotate) {
			document.btnManualRot.src='common/icons/manual_rotate_down.png';
			document.btnAutoRot.src='common/icons/auto_rotate_up.png';
			document.btnMagnifier.src='common/icons/enlarge_up.png';
		} else if(mode == global_mode_magnify) {
			document.btnMagnifier.src='common/icons/enlarge_down.png';
			document.btnAutoRot.src='common/icons/auto_rotate_up.png';
			document.btnManualRot.src='common/icons/manual_rotate_up.png';
		}
		
		this.currentMode = mode;
	},
	
	autoRot_onMouseOver : function() {
	
		if(this.currentMode == global_mode_auto_rotate)
			return;
		
		document.btnAutoRot.src='common/icons/auto_rotate_focused.png';
	},
			
	autoRot_onMouseOut : function() {
			
		if(this.currentMode == global_mode_auto_rotate)
			return;
		
		document.btnAutoRot.src='common/icons/auto_rotate_up.png';
	},
	
	autoRot_onMouseDown : function() {
	
		if(this.currentMode == global_mode_auto_rotate)
			return;
		
		document.btnAutoRot.src='common/icons/auto_rotate_down.png';
	},
	
	autoRot_onMouseClick : function() {
	
		if(this.currentMode == global_mode_auto_rotate)
			return;
		
		this.setMode(global_mode_auto_rotate);
		
		this.play();
	},
	
	manualRot_onMouseOver : function() {
	
		if(this.currentMode == global_mode_manual_rotate)
			return;
		
		document.btnManualRot.src='common/icons/manual_rotate_focused.png';
	},
			
	manualRot_onMouseOut : function() {
			
		if(this.currentMode == global_mode_manual_rotate)
			return;
		
		document.btnManualRot.src='common/icons/manual_rotate_up.png';
	},
	
	manualRot_onMouseDown : function() {
	
		if(this.currentMode == global_mode_manual_rotate)
			return;
		
		document.btnManualRot.src='common/icons/manual_rotate_down.png';
	},
	
	manualRot_onMouseClick : function() {
	
		if(this.currentMode == global_mode_manual_rotate)
			return;
			
		this.setMode(global_mode_manual_rotate);

		this.pause();
	},
	
	magnifier_onMouseOver : function() {
	
		if(this.currentMode == global_mode_magnify)
			return;
		
		document.btnMagnifier.src='common/icons/enlarge_focused.png';
	},
			
	magnifier_onMouseOut : function() {
			
		if(this.currentMode == global_mode_magnify)
			return;
		
		document.btnMagnifier.src='common/icons/enlarge_up.png';
	},
	
	magnifier_onMouseDown : function() {
	
		if(this.currentMode == global_mode_magnify)
			return;
		
		document.btnMagnifier.src='common/icons/enlarge_down.png';
	},
	
	magnifier_onMouseClick : function() {
	
		if(this.currentMode == global_mode_magnify)
			return;
		
		this.setMode(global_mode_magnify);
		
		this.magnify();
	},

    getEvent: function (event) {
        if (event.touches) {
            // ignore multi-touch
            if (event.touches.length > 1) return false;

            if (event.touches.length) {
                event.clientX = event.touches[0].clientX;
                event.clientY = event.touches[0].clientY;
            }
        }

        return event;
    },

    /* Loading */
    isPosLoaded: function (pos) {
        return (typeof this.frames[pos[0]] != 'undefined' && typeof this.frames[pos[0]][pos[1]] != 'undefined');
    },

    createLoadPlan: function (total, skip) {
        if (!skip) return [0];
        var plan = [];
        do {
            for (var i = 0; i < total; i += skip) {
                var f = Math.floor(i);
                if (plan.indexOf(f) == -1) {
                    plan.push(f);
                }
            }
            if (skip == 1) return plan;
            if ((skip /= 2) < 1) skip = 1;
        } while (true);
    },

    loadAllFrames: function () {
        // create the queue
        var queue = [],
			skipX = Math.floor(this.totalFrames[0] / this.options.initialLoad),
			planX = this.createLoadPlan(this.totalFrames[0], skipX),
			skipY = Math.floor(this.totalFrames[1] / this.options.initialLoad),
			planY = this.createLoadPlan(this.totalFrames[1], skipY);

        for (var y = 0; y < planY.length; y++) {
            for (var x = 0; x < planX.length; x++) {
                queue.push(this.validatePos([planX[x] + this.options.initialPos[0], planY[y] + this.options.initialPos[1]], true));
            }
        }

        // load the images
        this.loader = new VR.LoaderController(this, queue);

        queue = null;
        skipX = null;
        planX = null;
        skipY = null;
        planY = null;
    },

    getImageSource: function (pos) {
        var x = pos[0],
			y = pos[1],
			frame = (Math.floor(y * this.totalFrames[0] * this.frameMultipliers[0] * this.frameMultipliers[1]) + Math.floor(x * this.frameMultipliers[0]) + this.options.imageIndexOffset) + '';

        while (frame.length < this.numDigits) {
            frame = '0' + frame;
        }

        return this.imagePathParts[1] + frame + this.imagePathParts[3] + (this.options.noCache ? '?' + this.random : '');
    },

    getHDImageSource: function (pos) {
        var x = pos[0],
			y = pos[1],
			frame = (Math.floor(y * this.totalFrames[0] * this.frameMultipliers[0] * this.frameMultipliers[1]) + Math.floor(x * this.frameMultipliers[0]) + this.options.imageIndexOffset) + '';

        while (frame.length < this.numDigits) {
            frame = '0' + frame;
        }

        return this.hdImagePathParts[1] + frame + this.hdImagePathParts[3] + (this.options.noCache ? '?' + this.random : '');
    },

    /* Controls */
    makeInteractive: function () {
        this.bindGrabStart = this.onGrabStart.bind(this);
        this.bindGrabChange = this.onGrabChange.bind(this);
        this.bindGrabEnd = this.onGrabEnd.bind(this);
        this.vr.observe('mousedown', this.bindGrabStart);
        this.vr.observe('touchstart', this.bindGrabStart);
    },

    unmakeInteractive: function () {

        this.vr.down().stopObserving('touchmove', this.bindGrabChange);
        this.vr.down().stopObserving('touchend', this.bindGrabEnd);

        this.vr.stopObserving('mousedown', this.bindGrabStart);
        this.vr.stopObserving('touchstart', this.bindGrabStart);
    },

    recycle: function () {
        this.unmakeInteractive();
        delete this.frames;
        delete this.introSequence;
        delete this.loader;
    },

    atPosition: function (pos) {
        return (this.currentPos && pos[0] == this.currentPos[0] && pos[1] == this.currentPos[1]);
    },

    calcAbsolutePos: function (obj) {

        var posX = obj.offsetLeft;
        var posY = obj.offsetTop;

        while (obj.offsetParent) {
            if (obj == document.getElementsByTagName('body')[0]) {
                break;
            } else {
                posX = posX + obj.offsetParent.offsetLeft;
                posY = posY + obj.offsetParent.offsetTop;
                obj = obj.offsetParent;
            }
        }

        var posArray = [posX, posY];
        return posArray;
    },

    cursorWithinBounds: function (event) {

        var me = this;
        
        this.cursorPosX = event.pageX;
        this.cursorPosY = event.pageY;

        // Calculate pageX/Y if missing and clientX/Y available
        if ((event.pageX == null || event.pageX == 0) && (event.clientX != null && event.clientX != 0)) {
            var doc = document.documentElement, body = document.body;
            this.cursorPosX = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
            this.cursorPosY = event.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
        }

        var imageOffset = me.calcAbsolutePos(me.image);

        var minX = imageOffset[0];
        var minY = imageOffset[1];
        var maxX = minX + me.image.clientWidth;
        var maxY = minY + me.image.clientHeight;
        
        return this.cursorPosX > minX && this.cursorPosY > minY && this.cursorPosX < maxX && this.cursorPosY < maxY;
    },

    dispose: function () {
        var me = this;
        document.body.appendChild(me.canv);
        me.imgCanv = null;
    },

    play: function () {
    
        var me = this;

        me.hideMagnify();

        this.currentMode = global_mode_auto_rotate;

        if (me.playing)
            return;

        this.playing = true;
        this.playInterval = setInterval(this.gotoNextFrame.bind(this), this.playIntervalDuration);
    },

    pause: function () {
    	
        this.hideMagnify();

        this.currentMode = global_mode_manual_rotate;

        if (!this.playing)
            return;

        this.playing = false;
        clearInterval(this.playInterval);
    },

    maxmize: function () {

        var clientWidth = document.body.clientWidth;
        var clientHeight = document.body.clientHeight;

        var maxWidth = clientWidth;
        var maxHeight = clientHeight;

        var parentFrame = null;

        if (top && top.document) {
            parentFrame = top.document.getElementById("20130202_1");
        }

        maxWidth = 1000;
        maxHeight = 1000;

        if (parentFrame) {
            parentFrame.width = maxWidth;
            parentFrame.height = maxHeight;
        }

        maxHeight -= global_toolbar_height;

        var imageWidth = maxWidth;
        var imageHeight = imageWidth * global_src_image_height / global_src_image_width;

        if (imageHeight > maxHeight) {
            imageHeight = maxHeight;
            imageWidth = imageHeight * global_src_image_width / global_src_image_height;
        }

        global_image_width = imageWidth;
        global_image_height = imageHeight;

        this.gotoPos([this.currentPos[0], this.currentPos[1]]);
    },

    magnify: function () {

        var me = this;

        if (me.playing) {
            me.pause();
        }

        var currentPos = me.currentPos;
        var currentFrame = me.frames[currentPos[0]][currentPos[1]];

        me.image = currentFrame;

        me.conf = {
            lensRadius: global_lensRadius,
            xOff: 0,
            yOff: 0,
            zoom: global_zoom
        };

        me.canv = document.createElement('canvas');
        if (typeof G_vmlCanvasManager != "undefined") {
            G_vmlCanvasManager.initElement(me.canv);
        }

        me.hcanv = document.createElement('canvas');
        if (typeof G_vmlCanvasManager != "undefined") {
            G_vmlCanvasManager.initElement(me.hcanv);
        }

        me.canv.style.position = 'absolute';

        me.canv.style.display = '';

        me.canv.style.left = 0;

        me.canv.width = me.canv.height = me.hcanv.width = me.hcanv.height = me.conf.lensRadius;
        document.body.appendChild(me.canv);

        me.doZoom = true;

        me.currentMode = global_mode_magnify;

        me.imgCanv = null;

        var hdImagePath = me.getHDImageSource(me.currentPos);

        me.bigImage = new Image();
        me.bigImage.onload = this.onLoadBigImage.bind(this);

        me.bigImage.src = hdImagePath;

        this.bindGrabStart = this.onGrabStart.bind(this);
        this.bindGrabChange = this.onGrabChange.bind(this);
        this.bindGrabEnd = this.onGrabEnd.bind(this);

        listenOn(this.image, 'mousedown', this.bindGrabStart.scope(this));
        listenOn(this.image, 'touchstart', this.bindGrabStart.scope(this));
		
        listenOn(this.canv, 'mousedown', this.bindGrabStart.scope(this));
		listenOn(this.canv, 'touchstart', this.bindGrabStart.scope(this));

        listenOn(this.image, 'mousemove', this.bindGrabChange.scope(this));
        listenOn(this.image, 'touchmove', this.bindGrabChange.scope(this));
		
        listenOn(this.canv, 'mousemove', this.bindGrabChange.scope(this));
        listenOn(this.canv, 'touchmove', this.bindGrabChange.scope(this));
    },

    onLoadBigImage: function () {
        var me = this;
        var im = me.bigImage;
        if (!im.complete && im.width == 0 && im.height == 0)
            return;
        me.imgCanv = me.createScaledImageCanvas(me.image, me.conf.zoom, me.bigImage);
    },

    createScaledImageCanvas: function (img, zoom, orgImg) {
        orgImg = orgImg || img;
        var tmpCanv = document.createElement('canvas');
        if (typeof G_vmlCanvasManager != "undefined") {
            G_vmlCanvasManager.initElement(tmpCanv);
        }
        tmpCanv.width = img.width * zoom;
        tmpCanv.height = img.height * zoom;
        var con = tmpCanv.getContext('2d');
        con.drawImage(orgImg, 0, 0, orgImg.width, orgImg.height, 0, 0, tmpCanv.width, tmpCanv.height);
        return tmpCanv;
    },

    hideMagnify: function () {

        var me = this;

        if (me.canv != null) {

            me.canv.style.display = 'none';
            document.body.removeChild(me.canv);
            me.canv = null;
        }

        me.doZoom = false;
    },

    onMagnifyGrabChange: function (e) {

        var me = this;

        if (!me.doZoom || !me.imgCanv)
            return;

        if (!me.cursorWithinBounds(e))
            return;

        var posX = this.cursorPosX;
        var posY = this.cursorPosY;
        
        var centerX = me.canv.width / 2;
        var centerY = me.canv.height / 2;
        var clW = me.canv.width / 2;
        var clH = me.canv.height / 2;
        var ctx = me.canv.getContext('2d');
        var hctx = me.hcanv.getContext('2d');

        me.canv.style.left = posX - clW + me.conf.xOff;
        me.canv.style.top = posY - clH + me.conf.yOff;

        ctx.globalCompositeOperation = 'source-over';

        var imageOffset = me.calcAbsolutePos(me.image);

        var lf = posX - imageOffset[0];
        var tp = posY - imageOffset[1];

        //Make xored shape due to chrome
        hctx.globalCompositeOperation = 'source-over';

        hctx.fillRect(-1, -1, me.canv.width + 1, me.canv.height + 1);
        hctx.globalCompositeOperation = 'xor';
        hctx.beginPath();
        hctx.arc(centerX, centerY, clW, 0, Math.PI * 2, true);
        hctx.closePath();
        hctx.fill();

        lf = lf * me.conf.zoom - clW;
        tp = tp * me.conf.zoom - clH;

        if (lf < 0)
            lf = 0;
        else if (lf > me.imgCanv.width - me.canv.width)
            lf = me.imgCanv.width - me.canv.width;

        if (tp < 0)
            tp = 0;
        else if (tp > me.imgCanv.height - me.canv.height)
            tp = me.imgCanv.height - me.canv.height;

        ctx.drawImage(me.bigImage, lf, tp, me.canv.width, me.canv.height, 0, 0, me.canv.width, me.canv.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(me.hcanv, 0, 0, me.canv.width, me.canv.height);
    },

    gotoNextFrame: function () {
        this.gotoPos([this.currentPos[0] + 1, this.currentPos[1]]);
    },

    validatePos: function (pos, forceContinuous) {
        for (var i = 0; i < 2; i++) {
            if (forceContinuous || this.options.infiniteAxis[i]) {
                while (pos[i] > this.totalFrames[i] - 1) {
                    pos[i] -= this.totalFrames[i];
                }
                while (pos[i] < 0) {
                    pos[i] += this.totalFrames[i];
                }
            } else {
                if (pos[i] > this.totalFrames[i] - 1) {
                    pos[i] = this.totalFrames[i] - 1;
                }
                if (pos[i] < 0) {
                    pos[i] = 0;
                }
            }
        }
        return pos;
    },

    gotoPos: function (pos, force) {

        // keep the pos in bounds
        pos = this.validatePos(pos);

        // are we already here?
        if (!force && this.atPosition(pos)) return;

        // go to the pos
        this.currentPos = pos;

        this.frame = this.frames[pos[0]][pos[1]];
        if (typeof this.frame != 'undefined' && this.frame.nodeType) {
            if (this.currentFrame) this.vr.removeChild(this.currentFrame);
            this.currentFrame = this.frame;

            this.currentFrame.width = global_image_width;
            this.currentFrame.height = global_image_height;

            this.vr.appendChild(this.currentFrame);
        } else {
            this.loader.loadNow(pos);
        }
        delete this.frame;
    },
	
    validateEventType: function(e) {

		if(e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend')
			this.detectedTouchEvent = true;

        if (!(e = this.getEvent(e)))
            return false;
			
		if(this.detectedTouchEvent == true && (e.type == 'mousedown' || e.type == 'mousemove' || e.type == 'mouseup'))
			return false;
		
		return true;
	},

    /* Grabbing */
    onGrabStart: function (event) {
	
        if(this.validateEventType(event) == false)
            return;
		
        if (event.type != "touchstart" && this.currentMode != global_mode_manual_rotate) {
            this.setMode(global_mode_manual_rotate);
            this.pause();
        }

        this.grabbing = true;
        $(document.body).addClassName('grabbing');

        $(document).observe('mousemove', this.bindGrabChange);
        $(document).observe('touchmove', this.bindGrabChange);
		
        $(document).observe('mouseup', this.bindGrabEnd);
        $(document).observe('touchend', this.bindGrabEnd);
		
        this.vr.down().observe('mousemove', this.bindGrabChange);
        this.vr.down().observe('touchmove', this.bindGrabChange);
		
        this.vr.down().observe('mouseup', this.bindGrabEnd);
        this.vr.down().observe('touchend', this.bindGrabEnd);

        this.grabHistory = $A([event]);
        this.onGrabChange.clientX = this.onGrabChange.clientY = null;
        this.grabHistoryInterval = setInterval(this.updateGrabHistory.bind(this), 10);

        // save state for later
        this.onGrabStart.clientX = event.clientX;
        this.onGrabStart.clientY = event.clientY;
        this.onGrabStart.playing = this.playing;
        this.onGrabStart.pos = this.currentPos;

        // pause and stop throwing
        this.stopThrowing();

        // prevent default event behavior
        this.preventDefault(event);
    },

    onGrabChange: function (event) {

        if(this.validateEventType(event) == false)
            return;

        //magnify
        if (this.currentMode == global_mode_magnify) {
            this.onMagnifyGrabChange(event);
            return;
        }

        if (this.currentMode == global_mode_auto_rotate)
            return;

        // IE likes to fire onmousemove even when the mouse has not moved
        if (!(event.clientX == this.onGrabStart.clientX && event.clientY == this.onGrabStart.clientY)) {

            // save the event for later
            this.onGrabChange.clientX = event.clientX;
            this.onGrabChange.clientY = event.clientY;

            var pos = this.getGrabPos(event);
            if (pos) this.gotoPos(pos);
        }

        // prevent the default behavior
        this.preventDefault(event);
    },

    onGrabEnd: function (event) {
	
        if(this.validateEventType(event) == false)
            return;

        //magnify 
        if (this.currentMode == global_mode_magnify)
            return;

        this.grabbing = false;
        $(document.body).removeClassName('grabbing');
		
        $(document).stopObserving('mousemove', this.bindGrabChange);
        $(document).stopObserving('touchmove', this.bindGrabChange);
		
        $(document).stopObserving('mouseup', this.bindGrabEnd);
        $(document).stopObserving('touchend', this.bindGrabEnd);
		
        clearInterval(this.grabHistoryInterval);

        // resume playing?
        if (this.options.throwable) {
            var diffX = event.clientX - this.grabHistory.last().clientX,
				diffY = event.clientY - this.grabHistory.last().clientY,
				loaded = true;

            if (diffX || diffY) {
                var dist = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2)),
					frames = Math.floor(dist / 5),
					clientX = this.grabHistory.last().clientX,
					clientY = this.grabHistory.last().clientY,
					changeX = true,
					changeY = true;

                // keep # of frames in-bounds
                if (frames < this.minThrowFrames) frames = this.minThrowFrames;
                else if (frames > this.maxThrowFrames) frames = this.maxThrowFrames;

                this.throwSequence = $A();

                for (var i = 0; i < frames; i++) {
                    var percent = i / frames,
						speed = Math.pow(percent - 1, 2),
						clientX = Math.floor(speed * diffX) + clientX,
						clientY = Math.floor(speed * diffY) + clientY,
						pos = this.validatePos(this.getGrabPos({ clientX: clientX, clientY: clientY }));

                    // once an axis rotates slowly enough to use the same row/column for two frames,
                    // stop rotating that axis entirely
                    if (!changeX) pos[0] = this.throwSequence.last()[0];
                    else if (this.throwSequence.length && pos[0] == this.throwSequence.last()[0]) changeX = false;
                    if (!changeY) pos[1] = this.throwSequence.last()[1];
                    else if (this.throwSequence.length && pos[1] == this.throwSequence.last()[1]) changeY = false;

                    // cancel if every frame isn't loaded
                    if (!this.isPosLoaded(pos)) {
                        loaded = false;
                        break;
                    }

                    this.throwSequence.push(pos);
                }

                if (loaded) {
                    this.throwing = true;
                    this.throwInterval = setInterval(this.throwStep.bind(this), this.playIntervalDuration);
                }
            }
        }
    },

    preventDefault: function (event) {

        if(event.stop)
            event.stop();
        else
            event.returnValue = false;
    },

    getGrabPos: function (event) {
        var diffX = event.clientX - this.onGrabStart.clientX,
			diffY = event.clientY - this.onGrabStart.clientY,
			percentDiffX = diffX / this.options.grabRotateDistance,
			percentDiffY = diffY / this.options.grabRotateDistance,
			frameDiffX = Math.round(this.totalFrames[0] * percentDiffX),
			frameDiffY = Math.round(this.totalFrames[1] * percentDiffY),
			posX = this.onGrabStart.pos[0] + frameDiffX,
			posY = this.onGrabStart.pos[1] + frameDiffY;

        return [posX, posY];
    },

    updateGrabHistory: function () {
        var func = this.onGrabChange.clientX ? this.onGrabChange : this.onGrabStart;
        this.grabHistory.unshift({ clientX: func.clientX, clientY: func.clientY });
        if (this.grabHistory.length > 3) {
            this.grabHistory.splice(3);
        }
    },

    throwStep: function () {
        this.gotoPos(this.throwSequence.shift());
        if (!this.throwSequence.length) {
            this.stopThrowing();
        }
    },

    stopThrowing: function () {
        if (!this.throwing) return;
        this.throwing = false;
        clearInterval(this.throwInterval);
    }
});


VR.LoaderController = Class.create({
	initialize: function(vr, queue, onLoad){
		this.vr = vr;
		this.queue = queue;
		this.onLoad = onLoad;
		this.retiredLoaders = new Array();

		for (var i=0; i<this.vr.options.loaders; i++) {
			this.loadNext(new VR.Loader(this));
		}
	},
	loadNext: function(loader){
		if (this.queue.length) {
			loader.load(this.queue.shift());
		} else {
			this.retiredLoaders.push(loader);
			if (this.retiredLoaders.length == this.vr.options.loaders && typeof this.onLoad == 'function'){
				this.onLoad();
				this.onLoad = null;
			}
		}
	},
	loadNow: function(pos){
		if (this.retiredLoaders.length) {
			this.retiredLoaders.shift().load(pos);
		} else {
			this.queue.unshift(pos);
		}
	}
});


VR.Loader = Class.create({
	initialize: function(controller){
		this.controller = controller;
		this.loadNext = this.controller.loadNext.bind(this.controller);
	},
	load: function(pos) {
		this.pos = pos;

		// skip if already loaded
		if (this.controller.vr.isPosLoaded(pos)) {
			this.controller.loadNext(this);
			return;
		}

		this.img = new Image();
		this.img.onload = this.onLoad.bind(this);

		this.controller.vr.frames[this.pos[0]][this.pos[1]] = true;
		this.img.src = this.controller.vr.getImageSource(this.pos);
		//this.img.title = this.controller.vr.getHDImageSource(this.pos);
		
		delete this.img;
	},
	onLoad: function(event){
		
		var imgLoaded = this.img;
		
		if(event && event.target) {
			imgLoaded = event.target;
			delete event.target.onload;
		}
		
		this.controller.vr.frames[this.pos[0]][this.pos[1]] = imgLoaded;
		
		// should we show this now?
		if (this.controller.vr.atPosition(this.pos)) {
			this.controller.vr.gotoPos(this.pos, true);
		}

		// load next
		// (delay by 1ms to prevent IE's Stack Overflow error)
		this.loadNext.defer(this);
	}
});
