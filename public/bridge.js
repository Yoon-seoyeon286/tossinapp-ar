// apps-in-toss 네이티브 브릿지 헬퍼

if (!window.__GRANITE_NATIVE_EMITTER) {
    window.__GRANITE_NATIVE_EMITTER = {
        _events: {},
        emit: function(event, data) {
            var cbs = this._events[event] || [];
            for (var i = 0; i < cbs.length; i++) cbs[i](data);
        },
        on: function(event, cb) {
            var self = this;
            if (!self._events[event]) self._events[event] = [];
            self._events[event].push(cb);
            return function() {
                self._events[event] = (self._events[event] || []).filter(function(fn) { return fn !== cb; });
            };
        }
    };
}

function _nativeEventId() {
    return Math.random().toString(36).substring(2, 15);
}

function _callBridge(method, params) {
    return new Promise(function(resolve, reject) {
        if (!window.ReactNativeWebView) {
            reject(new Error('bridge_unavailable'));
            return;
        }
        var id = _nativeEventId();
        var subs = [];
        subs.push(window.__GRANITE_NATIVE_EMITTER.on(method + '/resolve/' + id, function(data) {
            subs.forEach(function(fn) { fn(); });
            resolve(data);
        }));
        subs.push(window.__GRANITE_NATIVE_EMITTER.on(method + '/reject/' + id, function(err) {
            subs.forEach(function(fn) { fn(); });
            reject(err);
        }));
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'method', functionName: method, eventId: id, args: [params]
        }));
    });
}

async function _requestCameraPermission() {
    try {
        await _callBridge('requestPermission', { name: 'camera', access: 'access' });
        console.log('[AR] 카메라 권한 요청 완료');
    } catch (e) {
        console.warn('[AR] 카메라 권한 요청 실패 (비WebView 환경):', e.message);
    }
}

async function _saveToGallery(blob) {
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = async function(e) {
            var base64 = e.target.result.split(',')[1];
            var fileName = 'ar-capture-' + Date.now() + '.jpg';
            console.log('[AR] base64 길이:', base64.length);
            try {
                await _callBridge('saveBase64Data', { data: base64, fileName: fileName, mimeType: 'image/jpeg' });
                resolve('saved');
            } catch (bridgeErr) {
                var msg = bridgeErr && bridgeErr.message ? bridgeErr.message : JSON.stringify(bridgeErr);
                console.error('[AR] saveBase64Data 실패:', msg);
                reject(new Error('save_failed: ' + msg));
            }
        };
        reader.readAsDataURL(blob);
    });
}
