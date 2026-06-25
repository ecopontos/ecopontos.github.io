var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-action-sheet.entry.js
var pwa_action_sheet_entry_exports = {};
__export(pwa_action_sheet_entry_exports, {
  pwa_action_sheet: () => PWAActionSheet
});
var actionSheetCss, PWAActionSheet;
var init_pwa_action_sheet_entry = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-action-sheet.entry.js"() {
    init_index_1c5c47b4();
    actionSheetCss = ':host{z-index:1000;position:fixed;top:0;left:0;width:100%;height:100%;display:-ms-flexbox;display:flex;contain:strict;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;font-family:-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Roboto", sans-serif}.wrapper{-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;background-color:rgba(0, 0, 0, 0);-webkit-transition:400ms background-color cubic-bezier(.36,.66,.04,1);transition:400ms background-color cubic-bezier(.36,.66,.04,1)}.wrapper.open{background-color:rgba(0, 0, 0, 0.32)}.title{color:#999;height:23px;line-height:23px;padding-bottom:17px;-webkit-padding-end:16px;padding-inline-end:16px;-webkit-padding-start:16px;padding-inline-start:16px;padding-left:16px;padding-right:16px;padding-top:20px}.content{width:568px;-ms-flex-item-align:end;align-self:flex-end;background-color:#fff;-webkit-transition:400ms -webkit-transform cubic-bezier(.36,.66,.04,1);transition:400ms -webkit-transform cubic-bezier(.36,.66,.04,1);transition:400ms transform cubic-bezier(.36,.66,.04,1);transition:400ms transform cubic-bezier(.36,.66,.04,1), 400ms -webkit-transform cubic-bezier(.36,.66,.04,1);-webkit-transform:translateY(100%);transform:translateY(100%)}.wrapper.open .content{-webkit-transform:translateY(0%);transform:translateY(0%)}@media only screen and (max-width: 568px){.content{width:100%}}.action-sheet-option{cursor:pointer;height:52px;line-height:52px}.action-sheet-button{color:rgb(38, 38, 38);font-size:16px;-webkit-padding-end:16px;padding-inline-end:16px;-webkit-padding-start:16px;padding-inline-start:16px;padding-left:16px;padding-right:16px;padding-top:0px}.action-sheet-button:hover{background-color:#F6F6F6}';
    PWAActionSheet = (function() {
      function e(e2) {
        registerInstance(this, e2);
        this.onSelection = createEvent(this, "onSelection", 7);
        this.header = void 0;
        this.cancelable = true;
        this.options = [];
        this.open = false;
      }
      e.prototype.componentDidLoad = function() {
        var e2 = this;
        requestAnimationFrame((function() {
          e2.open = true;
        }));
      };
      e.prototype.dismiss = function() {
        if (this.cancelable) {
          this.close();
        }
      };
      e.prototype.close = function() {
        var e2 = this;
        this.open = false;
        setTimeout((function() {
          e2.el.parentNode.removeChild(e2.el);
        }), 500);
      };
      e.prototype.handleOptionClick = function(e2, t) {
        e2.stopPropagation();
        this.onSelection.emit(t);
        this.close();
      };
      e.prototype.render = function() {
        var e2 = this;
        return h("div", { class: "wrapper".concat(this.open ? " open" : ""), onClick: function() {
          return e2.dismiss();
        } }, h("div", { class: "content" }, h("div", { class: "title" }, this.header), this.options.map((function(t, n) {
          return h("div", { class: "action-sheet-option", onClick: function(t2) {
            return e2.handleOptionClick(t2, n);
          } }, h("div", { class: "action-sheet-button" }, t.title));
        }))));
      };
      Object.defineProperty(e.prototype, "el", { get: function() {
        return getElement(this);
      }, enumerable: false, configurable: true });
      return e;
    })();
    PWAActionSheet.style = actionSheetCss;
  }
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera-modal.entry.js
var pwa_camera_modal_entry_exports = {};
__export(pwa_camera_modal_entry_exports, {
  pwa_camera_modal: () => PWACameraModal
});
var __awaiter, __generator, cameraModalCss, PWACameraModal;
var init_pwa_camera_modal_entry = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera-modal.entry.js"() {
    init_index_1c5c47b4();
    __awaiter = function(e, t, n, r) {
      function i(e2) {
        return e2 instanceof n ? e2 : new n((function(t2) {
          t2(e2);
        }));
      }
      return new (n || (n = Promise))((function(n2, o) {
        function a(e2) {
          try {
            c(r.next(e2));
          } catch (e3) {
            o(e3);
          }
        }
        function s(e2) {
          try {
            c(r["throw"](e2));
          } catch (e3) {
            o(e3);
          }
        }
        function c(e2) {
          e2.done ? n2(e2.value) : i(e2.value).then(a, s);
        }
        c((r = r.apply(e, t || [])).next());
      }));
    };
    __generator = function(e, t) {
      var n = { label: 0, sent: function() {
        if (o[0] & 1) throw o[1];
        return o[1];
      }, trys: [], ops: [] }, r, i, o, a;
      return a = { next: s(0), throw: s(1), return: s(2) }, typeof Symbol === "function" && (a[Symbol.iterator] = function() {
        return this;
      }), a;
      function s(e2) {
        return function(t2) {
          return c([e2, t2]);
        };
      }
      function c(s2) {
        if (r) throw new TypeError("Generator is already executing.");
        while (a && (a = 0, s2[0] && (n = 0)), n) try {
          if (r = 1, i && (o = s2[0] & 2 ? i["return"] : s2[0] ? i["throw"] || ((o = i["return"]) && o.call(i), 0) : i.next) && !(o = o.call(i, s2[1])).done) return o;
          if (i = 0, o) s2 = [s2[0] & 2, o.value];
          switch (s2[0]) {
            case 0:
            case 1:
              o = s2;
              break;
            case 4:
              n.label++;
              return { value: s2[1], done: false };
            case 5:
              n.label++;
              i = s2[1];
              s2 = [0];
              continue;
            case 7:
              s2 = n.ops.pop();
              n.trys.pop();
              continue;
            default:
              if (!(o = n.trys, o = o.length > 0 && o[o.length - 1]) && (s2[0] === 6 || s2[0] === 2)) {
                n = 0;
                continue;
              }
              if (s2[0] === 3 && (!o || s2[1] > o[0] && s2[1] < o[3])) {
                n.label = s2[1];
                break;
              }
              if (s2[0] === 6 && n.label < o[1]) {
                n.label = o[1];
                o = s2;
                break;
              }
              if (o && n.label < o[2]) {
                n.label = o[2];
                n.ops.push(s2);
                break;
              }
              if (o[2]) n.ops.pop();
              n.trys.pop();
              continue;
          }
          s2 = t.call(e, n);
        } catch (e2) {
          s2 = [6, e2];
          i = 0;
        } finally {
          r = o = 0;
        }
        if (s2[0] & 5) throw s2[1];
        return { value: s2[0] ? s2[1] : void 0, done: true };
      }
    };
    cameraModalCss = ":host{z-index:1000;position:fixed;top:0;left:0;width:100%;height:100%;display:-ms-flexbox;display:flex;contain:strict}.wrapper{-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;background-color:rgba(0, 0, 0, 0.15)}.content{-webkit-box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);width:600px;height:600px}";
    PWACameraModal = (function() {
      function e(e2) {
        registerInstance(this, e2);
        this.onPhoto = createEvent(this, "onPhoto", 7);
        this.noDeviceError = createEvent(this, "noDeviceError", 7);
        this.facingMode = "user";
        this.hidePicker = false;
      }
      e.prototype.present = function() {
        return __awaiter(this, void 0, void 0, (function() {
          var e2;
          var t = this;
          return __generator(this, (function(n) {
            e2 = document.createElement("pwa-camera-modal-instance");
            e2.facingMode = this.facingMode;
            e2.hidePicker = this.hidePicker;
            e2.addEventListener("onPhoto", (function(e3) {
              return __awaiter(t, void 0, void 0, (function() {
                var t2;
                return __generator(this, (function(n2) {
                  if (!this._modal) {
                    return [2];
                  }
                  t2 = e3.detail;
                  this.onPhoto.emit(t2);
                  return [2];
                }));
              }));
            }));
            e2.addEventListener("noDeviceError", (function(e3) {
              return __awaiter(t, void 0, void 0, (function() {
                return __generator(this, (function(t2) {
                  this.noDeviceError.emit(e3);
                  return [2];
                }));
              }));
            }));
            document.body.append(e2);
            this._modal = e2;
            return [2];
          }));
        }));
      };
      e.prototype.dismiss = function() {
        return __awaiter(this, void 0, void 0, (function() {
          return __generator(this, (function(e2) {
            if (!this._modal) {
              return [2];
            }
            this._modal && this._modal.parentNode.removeChild(this._modal);
            this._modal = null;
            return [2];
          }));
        }));
      };
      e.prototype.render = function() {
        return h("div", null);
      };
      return e;
    })();
    PWACameraModal.style = cameraModalCss;
  }
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-toast.entry.js
var pwa_toast_entry_exports = {};
__export(pwa_toast_entry_exports, {
  pwa_toast: () => PWAToast
});
var toastCss, PWAToast;
var init_pwa_toast_entry = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-toast.entry.js"() {
    init_index_1c5c47b4();
    toastCss = ':host{position:fixed;bottom:20px;left:0;right:0;display:-ms-flexbox;display:flex;opacity:0}:host(.in){-webkit-transition:opacity 300ms;transition:opacity 300ms;opacity:1}:host(.out){-webkit-transition:opacity 1s;transition:opacity 1s;opacity:0}.wrapper{-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center}.toast{font-family:-apple-system, system-ui, "Helvetica Neue", Roboto, sans-serif;background-color:#eee;color:black;border-radius:5px;padding:10px 15px;font-size:14px;font-weight:500;-webkit-box-shadow:0px 1px 2px rgba(0, 0, 0, 0.20);box-shadow:0px 1px 2px rgba(0, 0, 0, 0.20)}';
    PWAToast = (function() {
      function t(t2) {
        registerInstance(this, t2);
        this.message = void 0;
        this.duration = 2e3;
        this.closing = null;
      }
      t.prototype.hostData = function() {
        var t2 = { out: !!this.closing };
        if (this.closing !== null) {
          t2["in"] = !this.closing;
        }
        return { class: t2 };
      };
      t.prototype.componentDidLoad = function() {
        var t2 = this;
        setTimeout((function() {
          t2.closing = false;
        }));
        setTimeout((function() {
          t2.close();
        }), this.duration);
      };
      t.prototype.close = function() {
        var t2 = this;
        this.closing = true;
        setTimeout((function() {
          t2.el.parentNode.removeChild(t2.el);
        }), 1e3);
      };
      t.prototype.__stencil_render = function() {
        return h("div", { class: "wrapper" }, h("div", { class: "toast" }, this.message));
      };
      Object.defineProperty(t.prototype, "el", { get: function() {
        return getElement(this);
      }, enumerable: false, configurable: true });
      t.prototype.render = function() {
        return h(Host, this.hostData(), this.__stencil_render());
      };
      return t;
    })();
    PWAToast.style = toastCss;
  }
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera-modal-instance.entry.js
var pwa_camera_modal_instance_entry_exports = {};
__export(pwa_camera_modal_instance_entry_exports, {
  pwa_camera_modal_instance: () => PWACameraModal2
});
var __awaiter2, __generator2, cameraModalInstanceCss, PWACameraModal2;
var init_pwa_camera_modal_instance_entry = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera-modal-instance.entry.js"() {
    init_index_1c5c47b4();
    __awaiter2 = function(e, t, n, o) {
      function r(e2) {
        return e2 instanceof n ? e2 : new n((function(t2) {
          t2(e2);
        }));
      }
      return new (n || (n = Promise))((function(n2, i) {
        function a(e2) {
          try {
            s(o.next(e2));
          } catch (e3) {
            i(e3);
          }
        }
        function c(e2) {
          try {
            s(o["throw"](e2));
          } catch (e3) {
            i(e3);
          }
        }
        function s(e2) {
          e2.done ? n2(e2.value) : r(e2.value).then(a, c);
        }
        s((o = o.apply(e, t || [])).next());
      }));
    };
    __generator2 = function(e, t) {
      var n = { label: 0, sent: function() {
        if (i[0] & 1) throw i[1];
        return i[1];
      }, trys: [], ops: [] }, o, r, i, a;
      return a = { next: c(0), throw: c(1), return: c(2) }, typeof Symbol === "function" && (a[Symbol.iterator] = function() {
        return this;
      }), a;
      function c(e2) {
        return function(t2) {
          return s([e2, t2]);
        };
      }
      function s(c2) {
        if (o) throw new TypeError("Generator is already executing.");
        while (a && (a = 0, c2[0] && (n = 0)), n) try {
          if (o = 1, r && (i = c2[0] & 2 ? r["return"] : c2[0] ? r["throw"] || ((i = r["return"]) && i.call(r), 0) : r.next) && !(i = i.call(r, c2[1])).done) return i;
          if (r = 0, i) c2 = [c2[0] & 2, i.value];
          switch (c2[0]) {
            case 0:
            case 1:
              i = c2;
              break;
            case 4:
              n.label++;
              return { value: c2[1], done: false };
            case 5:
              n.label++;
              r = c2[1];
              c2 = [0];
              continue;
            case 7:
              c2 = n.ops.pop();
              n.trys.pop();
              continue;
            default:
              if (!(i = n.trys, i = i.length > 0 && i[i.length - 1]) && (c2[0] === 6 || c2[0] === 2)) {
                n = 0;
                continue;
              }
              if (c2[0] === 3 && (!i || c2[1] > i[0] && c2[1] < i[3])) {
                n.label = c2[1];
                break;
              }
              if (c2[0] === 6 && n.label < i[1]) {
                n.label = i[1];
                i = c2;
                break;
              }
              if (i && n.label < i[2]) {
                n.label = i[2];
                n.ops.push(c2);
                break;
              }
              if (i[2]) n.ops.pop();
              n.trys.pop();
              continue;
          }
          c2 = t.call(e, n);
        } catch (e2) {
          c2 = [6, e2];
          r = 0;
        } finally {
          o = i = 0;
        }
        if (c2[0] & 5) throw c2[1];
        return { value: c2[0] ? c2[1] : void 0, done: true };
      }
    };
    cameraModalInstanceCss = ":host{z-index:1000;position:fixed;top:0;left:0;width:100%;height:100%;display:-ms-flexbox;display:flex;contain:strict;--inset-width:600px;--inset-height:600px}.wrapper{-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;background-color:rgba(0, 0, 0, 0.15)}.content{-webkit-box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);box-shadow:0px 0px 5px rgba(0, 0, 0, 0.2);width:var(--inset-width);height:var(--inset-height);max-height:100%}@media only screen and (max-width: 600px){.content{width:100%;height:100%}}";
    PWACameraModal2 = (function() {
      function e(e2) {
        var t = this;
        registerInstance(this, e2);
        this.onPhoto = createEvent(this, "onPhoto", 7);
        this.noDeviceError = createEvent(this, "noDeviceError", 7);
        this.handlePhoto = function(e3) {
          return __awaiter2(t, void 0, void 0, (function() {
            return __generator2(this, (function(t2) {
              this.onPhoto.emit(e3);
              return [2];
            }));
          }));
        };
        this.handleNoDeviceError = function(e3) {
          return __awaiter2(t, void 0, void 0, (function() {
            return __generator2(this, (function(t2) {
              this.noDeviceError.emit(e3);
              return [2];
            }));
          }));
        };
        this.facingMode = "user";
        this.hidePicker = false;
        this.noDevicesText = "No camera found";
        this.noDevicesButtonText = "Choose image";
      }
      e.prototype.handleBackdropClick = function(e2) {
        if (e2.target !== this.el) {
          this.onPhoto.emit(null);
        }
      };
      e.prototype.handleComponentClick = function(e2) {
        e2.stopPropagation();
      };
      e.prototype.handleBackdropKeyUp = function(e2) {
        if (e2.key === "Escape") {
          this.onPhoto.emit(null);
        }
      };
      e.prototype.render = function() {
        var e2 = this;
        return h("div", { class: "wrapper", onClick: function(t) {
          return e2.handleBackdropClick(t);
        } }, h("div", { class: "content" }, h("pwa-camera", { onClick: function(t) {
          return e2.handleComponentClick(t);
        }, facingMode: this.facingMode, hidePicker: this.hidePicker, handlePhoto: this.handlePhoto, handleNoDeviceError: this.handleNoDeviceError, noDevicesButtonText: this.noDevicesButtonText, noDevicesText: this.noDevicesText })));
      };
      Object.defineProperty(e.prototype, "el", { get: function() {
        return getElement(this);
      }, enumerable: false, configurable: true });
      return e;
    })();
    PWACameraModal2.style = cameraModalInstanceCss;
  }
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera.entry.js
var pwa_camera_entry_exports = {};
__export(pwa_camera_entry_exports, {
  pwa_camera: () => CameraPWA
});
var __awaiter3, __generator3, ImageCapture, cameraCss, CameraPWA;
var init_pwa_camera_entry = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/pwa-camera.entry.js"() {
    init_index_1c5c47b4();
    __awaiter3 = function(e, t, i, n) {
      function r(e2) {
        return e2 instanceof i ? e2 : new i((function(t2) {
          t2(e2);
        }));
      }
      return new (i || (i = Promise))((function(i2, a) {
        function o(e2) {
          try {
            c(n.next(e2));
          } catch (e3) {
            a(e3);
          }
        }
        function s(e2) {
          try {
            c(n["throw"](e2));
          } catch (e3) {
            a(e3);
          }
        }
        function c(e2) {
          e2.done ? i2(e2.value) : r(e2.value).then(o, s);
        }
        c((n = n.apply(e, t || [])).next());
      }));
    };
    __generator3 = function(e, t) {
      var i = { label: 0, sent: function() {
        if (a[0] & 1) throw a[1];
        return a[1];
      }, trys: [], ops: [] }, n, r, a, o;
      return o = { next: s(0), throw: s(1), return: s(2) }, typeof Symbol === "function" && (o[Symbol.iterator] = function() {
        return this;
      }), o;
      function s(e2) {
        return function(t2) {
          return c([e2, t2]);
        };
      }
      function c(s2) {
        if (n) throw new TypeError("Generator is already executing.");
        while (o && (o = 0, s2[0] && (i = 0)), i) try {
          if (n = 1, r && (a = s2[0] & 2 ? r["return"] : s2[0] ? r["throw"] || ((a = r["return"]) && a.call(r), 0) : r.next) && !(a = a.call(r, s2[1])).done) return a;
          if (r = 0, a) s2 = [s2[0] & 2, a.value];
          switch (s2[0]) {
            case 0:
            case 1:
              a = s2;
              break;
            case 4:
              i.label++;
              return { value: s2[1], done: false };
            case 5:
              i.label++;
              r = s2[1];
              s2 = [0];
              continue;
            case 7:
              s2 = i.ops.pop();
              i.trys.pop();
              continue;
            default:
              if (!(a = i.trys, a = a.length > 0 && a[a.length - 1]) && (s2[0] === 6 || s2[0] === 2)) {
                i = 0;
                continue;
              }
              if (s2[0] === 3 && (!a || s2[1] > a[0] && s2[1] < a[3])) {
                i.label = s2[1];
                break;
              }
              if (s2[0] === 6 && i.label < a[1]) {
                i.label = a[1];
                a = s2;
                break;
              }
              if (a && i.label < a[2]) {
                i.label = a[2];
                i.ops.push(s2);
                break;
              }
              if (a[2]) i.ops.pop();
              i.trys.pop();
              continue;
          }
          s2 = t.call(e, i);
        } catch (e2) {
          s2 = [6, e2];
          r = 0;
        } finally {
          n = a = 0;
        }
        if (s2[0] & 5) throw s2[1];
        return { value: s2[0] ? s2[1] : void 0, done: true };
      }
    };
    ImageCapture = window.ImageCapture;
    if (typeof ImageCapture === "undefined") {
      ImageCapture = (function() {
        function e(e2) {
          var t = this;
          if (e2.kind !== "video") throw new DOMException("NotSupportedError");
          this._videoStreamTrack = e2;
          if (!("readyState" in this._videoStreamTrack)) {
            this._videoStreamTrack.readyState = "live";
          }
          this._previewStream = new MediaStream([e2]);
          this.videoElement = document.createElement("video");
          this.videoElementPlaying = new Promise((function(e3) {
            t.videoElement.addEventListener("playing", e3);
          }));
          if (HTMLMediaElement) {
            this.videoElement.srcObject = this._previewStream;
          } else {
            this.videoElement.src = URL.createObjectURL(this._previewStream);
          }
          this.videoElement.muted = true;
          this.videoElement.setAttribute("playsinline", "");
          this.videoElement.play();
          this.canvasElement = document.createElement("canvas");
          this.canvas2dContext = this.canvasElement.getContext("2d");
        }
        Object.defineProperty(e.prototype, "videoStreamTrack", { get: function() {
          return this._videoStreamTrack;
        }, enumerable: false, configurable: true });
        e.prototype.getPhotoCapabilities = function() {
          return new Promise((function e2(t, i) {
            var n = { current: 0, min: 0, max: 0 };
            t({ exposureCompensation: n, exposureMode: "none", fillLightMode: ["none"], focusMode: "none", imageHeight: n, imageWidth: n, iso: n, redEyeReduction: false, whiteBalanceMode: "none", zoom: n });
            i(new DOMException("OperationError"));
          }));
        };
        e.prototype.setOptions = function(e2) {
          if (e2 === void 0) {
            e2 = {};
          }
          return new Promise((function e3(t, i) {
          }));
        };
        e.prototype.takePhoto = function() {
          var e2 = this;
          return new Promise((function t(i, n) {
            if (e2._videoStreamTrack.readyState !== "live") {
              return n(new DOMException("InvalidStateError"));
            }
            e2.videoElementPlaying.then((function() {
              try {
                e2.canvasElement.width = e2.videoElement.videoWidth;
                e2.canvasElement.height = e2.videoElement.videoHeight;
                e2.canvas2dContext.drawImage(e2.videoElement, 0, 0);
                e2.canvasElement.toBlob(i);
              } catch (e3) {
                n(new DOMException("UnknownError"));
              }
            }));
          }));
        };
        e.prototype.grabFrame = function() {
          var e2 = this;
          return new Promise((function t(i, n) {
            if (e2._videoStreamTrack.readyState !== "live") {
              return n(new DOMException("InvalidStateError"));
            }
            e2.videoElementPlaying.then((function() {
              try {
                e2.canvasElement.width = e2.videoElement.videoWidth;
                e2.canvasElement.height = e2.videoElement.videoHeight;
                e2.canvas2dContext.drawImage(e2.videoElement, 0, 0);
                i(window.createImageBitmap(e2.canvasElement));
              } catch (e3) {
                n(new DOMException("UnknownError"));
              }
            }));
          }));
        };
        return e;
      })();
    }
    window.ImageCapture = ImageCapture;
    cameraCss = ":host{--header-height:4em;--footer-height:9em;--header-height-landscape:3em;--footer-height-landscape:6em;--shutter-size:6em;--icon-size-header:1.5em;--icon-size-footer:2.5em;--margin-size-header:1.5em;--margin-size-footer:2.0em;font-family:-apple-system, BlinkMacSystemFont,\n    \u201CSegoe UI\u201D, \u201CRoboto\u201D, \u201CDroid Sans\u201D, \u201CHelvetica Neue\u201D, sans-serif;display:block;width:100%;height:100%}.items{-webkit-box-sizing:border-box;box-sizing:border-box;display:-ms-flexbox;display:flex;width:100%;height:100%;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center}.items .item{-ms-flex:1;flex:1;text-align:center}.items .item:first-child{text-align:left}.items .item:last-child{text-align:right}.camera-wrapper{position:relative;display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column;width:100%;height:100%}.camera-header{color:white;background-color:black;height:var(--header-height)}.camera-header .items{padding:var(--margin-size-header)}.camera-footer{position:relative;color:white;background-color:black;height:var(--footer-height)}.camera-footer .items{padding:var(--margin-size-footer)}@media (max-height: 375px){.camera-header{--header-height:var(--header-height-landscape)}.camera-footer{--footer-height:var(--footer-height-landscape)}.camera-footer .shutter{--shutter-size:4em}}.camera-video{position:relative;-ms-flex:1;flex:1;overflow:hidden;background-color:black}video{width:100%;height:100%;max-height:100%;min-height:100%;-o-object-fit:cover;object-fit:cover;background-color:black}.pick-image{display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;position:absolute;left:var(--margin-size-footer);top:0;height:100%;width:var(--icon-size-footer);color:white}.pick-image input{visibility:hidden}.pick-image svg{cursor:pointer;fill:white;width:var(--icon-size-footer);height:var(--icon-size-footer)}.shutter{position:absolute;left:50%;top:50%;width:var(--shutter-size);height:var(--shutter-size);margin-top:calc(var(--shutter-size) / -2);margin-left:calc(var(--shutter-size) / -2);border-radius:100%;background-color:#c6cdd8;padding:12px;-webkit-box-sizing:border-box;box-sizing:border-box}.shutter:active .shutter-button{background-color:#9da9bb}.shutter-button{background-color:white;border-radius:100%;width:100%;height:100%}.rotate{display:-ms-flexbox;display:flex;-ms-flex-align:center;align-items:center;position:absolute;right:var(--margin-size-footer);top:0;height:100%;width:var(--icon-size-footer);color:white}.rotate img{width:var(--icon-size-footer);height:var(--icon-size-footer)}.shutter-overlay{z-index:5;position:absolute;width:100%;height:100%;background-color:black}.error{width:100%;height:100%;color:white;display:-ms-flexbox;display:flex;-ms-flex-pack:center;justify-content:center;-ms-flex-align:center;align-items:center}.no-device{background-color:black;-ms-flex:1;flex:1;display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column;-ms-flex-align:center;align-items:center;-ms-flex-pack:center;justify-content:center;color:white}.no-device label{cursor:pointer;background:#fff;border-radius:6px;padding:6px 8px;color:black}.no-device input{visibility:hidden;height:0;margin-top:16px}.accept{background-color:black;-ms-flex:1;flex:1;overflow:hidden}.accept .accept-image{width:100%;height:100%;max-height:100%;background-position:center center;background-size:cover;background-repeat:no-repeat}.close img{cursor:pointer;width:var(--icon-size-header);height:var(--icon-size-header)}.flash img{width:var(--icon-size-header);height:var(--icon-size-header)}.accept-use img{width:var(--icon-size-footer);height:var(--icon-size-footer)}.accept-cancel img{width:var(--icon-size-footer);height:var(--icon-size-footer)}.offscreen-image-render{top:0;left:0;visibility:hidden;pointer-events:none;width:100%;height:100%}";
    CameraPWA = (function() {
      function e(e2) {
        var t = this;
        registerInstance(this, e2);
        this.hasMultipleCameras = false;
        this.hasFlash = false;
        this.flashModes = [];
        this.flashMode = "off";
        this.handlePickFile = function(e3) {
        };
        this.handleShutterClick = function(e3) {
          console.debug("shutter click");
          t.capture();
        };
        this.handleRotateClick = function(e3) {
          t.rotate();
        };
        this.handleClose = function(e3) {
          t.handlePhoto && t.handlePhoto(null);
        };
        this.handleFlashClick = function(e3) {
          t.cycleFlash();
        };
        this.handleCancelPhoto = function(e3) {
          var i = t.stream && t.stream.getTracks()[0];
          var n = i && i.getConstraints();
          t.photo = null;
          t.photoSrc = null;
          if (n) {
            t.initCamera({ video: { facingMode: n.facingMode } });
          } else {
            t.initCamera();
          }
        };
        this.handleAcceptPhoto = function(e3) {
          t.handlePhoto && t.handlePhoto(t.photo);
        };
        this.handleFileInputChange = function(e3) {
          return __awaiter3(t, void 0, void 0, (function() {
            var t2, i, n, r;
            return __generator3(this, (function(a) {
              switch (a.label) {
                case 0:
                  t2 = e3.target;
                  i = t2.files[0];
                  a.label = 1;
                case 1:
                  a.trys.push([1, 3, , 4]);
                  return [4, this.getOrientation(i)];
                case 2:
                  n = a.sent();
                  console.debug("Got orientation", n);
                  this.photoOrientation = n;
                  return [3, 4];
                case 3:
                  r = a.sent();
                  return [3, 4];
                case 4:
                  this.handlePhoto && this.handlePhoto(i);
                  return [2];
              }
            }));
          }));
        };
        this.handleVideoMetadata = function(e3) {
          console.debug("Video metadata", e3);
        };
        this.facingMode = "user";
        this.handlePhoto = void 0;
        this.hidePicker = false;
        this.handleNoDeviceError = void 0;
        this.noDevicesText = "No camera found";
        this.noDevicesButtonText = "Choose image";
        this.photo = void 0;
        this.photoSrc = void 0;
        this.showShutterOverlay = false;
        this.flashIndex = 0;
        this.hasCamera = null;
        this.rotation = 0;
        this.deviceError = null;
      }
      e.prototype.componentDidLoad = function() {
        return __awaiter3(this, void 0, void 0, (function() {
          return __generator3(this, (function(e2) {
            switch (e2.label) {
              case 0:
                this.defaultConstraints = { video: { facingMode: this.facingMode } };
                return [4, this.queryDevices()];
              case 1:
                e2.sent();
                return [4, this.initCamera()];
              case 2:
                e2.sent();
                return [2];
            }
          }));
        }));
      };
      e.prototype.disconnectedCallback = function() {
        this.stopStream();
        this.photoSrc && URL.revokeObjectURL(this.photoSrc);
      };
      e.prototype.hasImageCapture = function() {
        return "ImageCapture" in window;
      };
      e.prototype.queryDevices = function() {
        return __awaiter3(this, void 0, void 0, (function() {
          var e2, t, i;
          return __generator3(this, (function(n) {
            switch (n.label) {
              case 0:
                n.trys.push([0, 2, , 3]);
                return [4, navigator.mediaDevices.enumerateDevices()];
              case 1:
                e2 = n.sent();
                t = e2.filter((function(e3) {
                  return e3.kind == "videoinput";
                }));
                this.hasCamera = !!t.length;
                this.hasMultipleCameras = t.length > 1;
                return [3, 3];
              case 2:
                i = n.sent();
                this.deviceError = i;
                return [3, 3];
              case 3:
                return [2];
            }
          }));
        }));
      };
      e.prototype.initCamera = function(e2) {
        return __awaiter3(this, void 0, void 0, (function() {
          var t, i;
          return __generator3(this, (function(n) {
            switch (n.label) {
              case 0:
                if (!e2) {
                  e2 = this.defaultConstraints;
                }
                n.label = 1;
              case 1:
                n.trys.push([1, 3, , 4]);
                return [4, navigator.mediaDevices.getUserMedia(Object.assign({ video: true, audio: false }, e2))];
              case 2:
                t = n.sent();
                this.initStream(t);
                return [3, 4];
              case 3:
                i = n.sent();
                this.deviceError = i;
                this.handleNoDeviceError && this.handleNoDeviceError(i);
                return [3, 4];
              case 4:
                return [2];
            }
          }));
        }));
      };
      e.prototype.initStream = function(e2) {
        return __awaiter3(this, void 0, void 0, (function() {
          return __generator3(this, (function(t) {
            switch (t.label) {
              case 0:
                this.stream = e2;
                this.videoElement.srcObject = e2;
                if (!this.hasImageCapture()) return [3, 2];
                this.imageCapture = new window.ImageCapture(e2.getVideoTracks()[0]);
                return [4, this.initPhotoCapabilities(this.imageCapture)];
              case 1:
                t.sent();
                return [3, 3];
              case 2:
                this.deviceError = "No image capture";
                this.handleNoDeviceError && this.handleNoDeviceError();
                t.label = 3;
              case 3:
                forceUpdate(this.el);
                return [2];
            }
          }));
        }));
      };
      e.prototype.initPhotoCapabilities = function(e2) {
        return __awaiter3(this, void 0, void 0, (function() {
          var t;
          return __generator3(this, (function(i) {
            switch (i.label) {
              case 0:
                return [4, e2.getPhotoCapabilities()];
              case 1:
                t = i.sent();
                if (t.fillLightMode && t.fillLightMode.length > 1) {
                  this.flashModes = t.fillLightMode.map((function(e3) {
                    return e3;
                  }));
                  if (this.flashMode) {
                    this.flashMode = this.flashModes[this.flashModes.indexOf(this.flashMode)] || "off";
                    this.flashIndex = this.flashModes.indexOf(this.flashMode) || 0;
                  } else {
                    this.flashIndex = 0;
                  }
                }
                return [2];
            }
          }));
        }));
      };
      e.prototype.stopStream = function() {
        if (this.videoElement) {
          this.videoElement.srcObject = null;
        }
        this.stream && this.stream.getTracks().forEach((function(e2) {
          return e2.stop();
        }));
      };
      e.prototype.capture = function() {
        return __awaiter3(this, void 0, void 0, (function() {
          var e2, t;
          return __generator3(this, (function(i) {
            switch (i.label) {
              case 0:
                if (!this.hasImageCapture()) return [3, 5];
                i.label = 1;
              case 1:
                i.trys.push([1, 4, , 5]);
                return [4, this.imageCapture.takePhoto({ fillLightMode: this.flashModes.length > 1 ? this.flashMode : void 0 })];
              case 2:
                e2 = i.sent();
                return [4, this.flashScreen()];
              case 3:
                i.sent();
                this.promptAccept(e2);
                return [3, 5];
              case 4:
                t = i.sent();
                console.error("Unable to take photo!", t);
                return [3, 5];
              case 5:
                this.stopStream();
                return [2];
            }
          }));
        }));
      };
      e.prototype.promptAccept = function(e2) {
        return __awaiter3(this, void 0, void 0, (function() {
          var t;
          return __generator3(this, (function(i) {
            switch (i.label) {
              case 0:
                this.photo = e2;
                return [4, this.getOrientation(e2)];
              case 1:
                t = i.sent();
                console.debug("Got orientation", t);
                this.photoOrientation = t;
                if (t) {
                  switch (t) {
                    case 1:
                    case 2:
                      this.rotation = 0;
                      break;
                    case 3:
                    case 4:
                      this.rotation = 180;
                      break;
                    case 5:
                    case 6:
                      this.rotation = 90;
                      break;
                    case 7:
                    case 8:
                      this.rotation = 270;
                      break;
                  }
                }
                this.photoSrc = URL.createObjectURL(e2);
                return [2];
            }
          }));
        }));
      };
      e.prototype.getOrientation = function(e2) {
        return new Promise((function(t) {
          var i = new FileReader();
          i.onload = function(e3) {
            var i2 = new DataView(e3.target.result);
            if (i2.getUint16(0, false) !== 65496) {
              return t(-2);
            }
            var n = i2.byteLength;
            var r = 2;
            while (r < n) {
              var a = i2.getUint16(r, false);
              r += 2;
              if (a === 65505) {
                if (i2.getUint32(r += 2, false) !== 1165519206) {
                  return t(-1);
                }
                var o = i2.getUint16(r += 6, false) === 18761;
                r += i2.getUint32(r + 4, o);
                var s = i2.getUint16(r, o);
                r += 2;
                for (var c = 0; c < s; c++) {
                  if (i2.getUint16(r + c * 12, o) === 274) {
                    return t(i2.getUint16(r + c * 12 + 8, o));
                  }
                }
              } else if ((a & 65280) !== 65280) {
                break;
              } else {
                r += i2.getUint16(r, false);
              }
            }
            return t(-1);
          };
          i.readAsArrayBuffer(e2.slice(0, 64 * 1024));
        }));
      };
      e.prototype.rotate = function() {
        this.stopStream();
        var e2 = this.stream && this.stream.getTracks()[0];
        if (!e2) {
          return;
        }
        var t = e2.getConstraints();
        var i = t.facingMode;
        if (!i) {
          var n = e2.getCapabilities();
          if (n.facingMode) {
            i = n.facingMode[0];
          }
        }
        if (i === "environment") {
          this.initCamera({ video: { facingMode: "user" } });
        } else {
          this.initCamera({ video: { facingMode: "environment" } });
        }
      };
      e.prototype.setFlashMode = function(e2) {
        console.debug("New flash mode: ", e2);
        this.flashMode = e2;
      };
      e.prototype.cycleFlash = function() {
        if (this.flashModes.length > 0) {
          this.flashIndex = (this.flashIndex + 1) % this.flashModes.length;
          this.setFlashMode(this.flashModes[this.flashIndex]);
        }
      };
      e.prototype.flashScreen = function() {
        return __awaiter3(this, void 0, void 0, (function() {
          var e2 = this;
          return __generator3(this, (function(t) {
            return [2, new Promise((function(t2, i) {
              e2.showShutterOverlay = true;
              setTimeout((function() {
                e2.showShutterOverlay = false;
                t2();
              }), 100);
            }))];
          }));
        }));
      };
      e.prototype.iconExit = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' enable-background='new 0 0 512 512' xml:space='preserve'%3E%3Cg id='Icon_5_'%3E%3Cg%3E%3Cpath fill='%23FFFFFF' d='M402.2,134L378,109.8c-1.6-1.6-4.1-1.6-5.7,0L258.8,223.4c-1.6,1.6-4.1,1.6-5.7,0L139.6,109.8 c-1.6-1.6-4.1-1.6-5.7,0L109.8,134c-1.6,1.6-1.6,4.1,0,5.7l113.5,113.5c1.6,1.6,1.6,4.1,0,5.7L109.8,372.4c-1.6,1.6-1.6,4.1,0,5.7 l24.1,24.1c1.6,1.6,4.1,1.6,5.7,0l113.5-113.5c1.6-1.6,4.1-1.6,5.7,0l113.5,113.5c1.6,1.6,4.1,1.6,5.7,0l24.1-24.1 c1.6-1.6,1.6-4.1,0-5.7L288.6,258.8c-1.6-1.6-1.6-4.1,0-5.7l113.5-113.5C403.7,138.1,403.7,135.5,402.2,134z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.iconPhotos = function() {
        return h("svg", { xmlns: "http://www.w3.org/2000/svg", width: "512", height: "512", viewBox: "0 0 512 512" }, h("path", { d: "M450.29,112H142c-34,0-62,27.51-62,61.33V418.67C80,452.49,108,480,142,480H450c34,0,62-26.18,62-60V173.33C512,139.51,484.32,112,450.29,112Zm-77.15,61.34a46,46,0,1,1-46.28,46A46.19,46.19,0,0,1,373.14,173.33Zm-231.55,276c-17,0-29.86-13.75-29.86-30.66V353.85l90.46-80.79a46.54,46.54,0,0,1,63.44,1.83L328.27,337l-113,112.33ZM480,418.67a30.67,30.67,0,0,1-30.71,30.66H259L376.08,333a46.24,46.24,0,0,1,59.44-.16L480,370.59Z" }), h("path", { d: "M384,32H64A64,64,0,0,0,0,96V352a64.11,64.11,0,0,0,48,62V152a72,72,0,0,1,72-72H446A64.11,64.11,0,0,0,384,32Z" }));
      };
      e.prototype.iconConfirm = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' enable-background='new 0 0 512 512' xml:space='preserve'%3E%3Ccircle fill='%232CD865' cx='256' cy='256' r='256'/%3E%3Cg id='Icon_1_'%3E%3Cg%3E%3Cg%3E%3Cpath fill='%23FFFFFF' d='M208,301.4l-55.4-55.5c-1.5-1.5-4-1.6-5.6-0.1l-23.4,22.3c-1.6,1.6-1.7,4.1-0.1,5.7l81.6,81.4 c3.1,3.1,8.2,3.1,11.3,0l171.8-171.7c1.6-1.6,1.6-4.2-0.1-5.7l-23.4-22.3c-1.6-1.5-4.1-1.5-5.6,0.1L213.7,301.4 C212.1,303,209.6,303,208,301.4z'/%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.iconReverseCamera = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' enable-background='new 0 0 512 512' xml:space='preserve'%3E%3Cg%3E%3Cpath fill='%23FFFFFF' d='M352,0H160C72,0,0,72,0,160v192c0,88,72,160,160,160h192c88,0,160-72,160-160V160C512,72,440,0,352,0z M356.7,365.8l-3.7,3.3c-27,23.2-61.4,35.9-96.8,35.9c-72.4,0-135.8-54.7-147-125.6c-0.3-1.9-2-3.3-3.9-3.3H64 c-3.3,0-5.2-3.8-3.2-6.4l61.1-81.4c1.6-2.1,4.7-2.1,6.4-0.1l63.3,81.4c2,2.6,0.2,6.5-3.2,6.5h-40.6c-2.5,0-4.5,2.4-3.9,4.8 c11.5,51.5,59.2,90.6,112.4,90.6c26.4,0,51.8-9.7,73.7-27.9l3.1-2.5c1.6-1.3,3.9-1.1,5.3,0.3l18.5,18.6 C358.5,361.6,358.4,364.3,356.7,365.8z M451.4,245.6l-61,83.5c-1.6,2.2-4.8,2.2-6.4,0.1l-63.3-83.3c-2-2.6-0.1-6.4,3.2-6.4h40.8 c2.5,0,4.4-2.3,3.9-4.8c-5.1-24.2-17.8-46.5-36.5-63.7c-21.2-19.4-48.2-30.1-76-30.1c-26.5,0-52.6,9.7-73.7,27.3l-3.1,2.5 c-1.6,1.3-3.9,1.2-5.4-0.3l-18.5-18.5c-1.6-1.6-1.5-4.3,0.2-5.9l3.5-3.1c27-23.2,61.4-35.9,96.8-35.9c38,0,73.9,13.7,101.2,38.7 c23.2,21.1,40.3,55.2,45.7,90.1c0.3,1.9,1.9,3.4,3.9,3.4h41.3C451.4,239.2,453.3,243,451.4,245.6z'/%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.iconRetake = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' enable-background='new 0 0 512 512' xml:space='preserve'%3E%3Ccircle fill='%23727A87' cx='256' cy='256' r='256'/%3E%3Cg id='Icon_5_'%3E%3Cg%3E%3Cpath fill='%23FFFFFF' d='M394.2,142L370,117.8c-1.6-1.6-4.1-1.6-5.7,0L258.8,223.4c-1.6,1.6-4.1,1.6-5.7,0L147.6,117.8 c-1.6-1.6-4.1-1.6-5.7,0L117.8,142c-1.6,1.6-1.6,4.1,0,5.7l105.5,105.5c1.6,1.6,1.6,4.1,0,5.7L117.8,364.4c-1.6,1.6-1.6,4.1,0,5.7 l24.1,24.1c1.6,1.6,4.1,1.6,5.7,0l105.5-105.5c1.6-1.6,4.1-1.6,5.7,0l105.5,105.5c1.6,1.6,4.1,1.6,5.7,0l24.1-24.1 c1.6-1.6,1.6-4.1,0-5.7L288.6,258.8c-1.6-1.6-1.6-4.1,0-5.7l105.5-105.5C395.7,146.1,395.7,143.5,394.2,142z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.iconFlashOff = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' style='enable-background:new 0 0 512 512;' xml:space='preserve'%3E%3Cstyle type='text/css'%3E .st0%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Cg%3E%3Cpath class='st0' d='M498,483.7L42.3,28L14,56.4l149.8,149.8L91,293.8c-2.5,3-0.1,7.2,3.9,7.2h143.9c1.6,0,2.7,1.3,2.4,2.7 L197.6,507c-1,4.4,5.8,6.9,8.9,3.2l118.6-142.8L469.6,512L498,483.7z'/%3E%3Cpath class='st0' d='M449,218.2c2.5-3,0.1-7.2-3.9-7.2H301.2c-1.6,0-2.7-1.3-2.4-2.7L342.4,5c1-4.4-5.8-6.9-8.9-3.2L214.9,144.6 l161.3,161.3L449,218.2z'/%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.iconFlashOn = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' style='enable-background:new 0 0 512 512;' xml:space='preserve'%3E%3Cstyle type='text/css'%3E .st0%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Cpath class='st0' d='M287.2,211c-1.6,0-2.7-1.3-2.4-2.7L328.4,5c1-4.4-5.8-6.9-8.9-3.2L77,293.8c-2.5,3-0.1,7.2,3.9,7.2h143.9 c1.6,0,2.7,1.3,2.4,2.7L183.6,507c-1,4.4,5.8,6.9,8.9,3.2l242.5-292c2.5-3,0.1-7.2-3.9-7.2L287.2,211L287.2,211z'/%3E%3C/svg%3E";
      };
      e.prototype.iconFlashAuto = function() {
        return "data:image/svg+xml,%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 512 512' style='enable-background:new 0 0 512 512;' xml:space='preserve'%3E%3Cstyle type='text/css'%3E .st0%7Bfill:%23FFFFFF;%7D%0A%3C/style%3E%3Cpath class='st0' d='M287.2,211c-1.6,0-2.7-1.3-2.4-2.7L328.4,5c1-4.4-5.8-6.9-8.9-3.2L77,293.8c-2.5,3-0.1,7.2,3.9,7.2h143.9 c1.6,0,2.7,1.3,2.4,2.7L183.6,507c-1,4.4,5.8,6.9,8.9,3.2l242.5-292c2.5-3,0.1-7.2-3.9-7.2L287.2,211L287.2,211z'/%3E%3Cg%3E%3Cpath class='st0' d='M321.3,186l74-186H438l74,186h-43.5l-11.9-32.5h-80.9l-12,32.5H321.3z M415.8,47.9l-27.2,70.7h54.9l-27.2-70.7 H415.8z'/%3E%3C/g%3E%3C/svg%3E";
      };
      e.prototype.render = function() {
        var e2 = this;
        var t = {};
        return h("div", { class: "camera-wrapper" }, h("div", { class: "camera-header" }, h("section", { class: "items" }, h("div", { class: "item close", onClick: function(t2) {
          return e2.handleClose(t2);
        } }, h("img", { src: this.iconExit() })), h("div", { class: "item flash", onClick: function(t2) {
          return e2.handleFlashClick(t2);
        } }, this.flashModes.length > 0 && h("div", null, this.flashMode == "off" ? h("img", { src: this.iconFlashOff() }) : "", this.flashMode == "auto" ? h("img", { src: this.iconFlashAuto() }) : "", this.flashMode == "flash" ? h("img", { src: this.iconFlashOn() }) : "")))), (this.hasCamera === false || !!this.deviceError) && h("div", { class: "no-device" }, h("h2", null, this.noDevicesText), h("label", { htmlFor: "_pwa-elements-camera-input" }, this.noDevicesButtonText), h("input", { type: "file", id: "_pwa-elements-camera-input", onChange: this.handleFileInputChange, accept: "image/*", class: "select-file-button" })), this.photoSrc ? h("div", { class: "accept" }, h("div", { class: "accept-image", style: Object.assign({ backgroundImage: "url(".concat(this.photoSrc, ")") }, t) })) : h("div", { class: "camera-video" }, this.showShutterOverlay && h("div", { class: "shutter-overlay" }), this.hasImageCapture() ? h("video", { ref: function(t2) {
          return e2.videoElement = t2;
        }, onLoadedMetaData: this.handleVideoMetadata, autoplay: true, playsinline: true }) : h("canvas", { ref: function(t2) {
          return e2.canvasElement = t2;
        }, width: "100%", height: "100%" }), h("canvas", { class: "offscreen-image-render", ref: function(t2) {
          return e2.offscreenCanvas = t2;
        }, width: "100%", height: "100%" })), this.hasCamera && h("div", { class: "camera-footer" }, !this.photo ? [!this.hidePicker && h("div", { class: "pick-image", onClick: this.handlePickFile }, h("label", { htmlFor: "_pwa-elements-file-pick" }, this.iconPhotos()), h("input", { type: "file", id: "_pwa-elements-file-pick", onChange: this.handleFileInputChange, accept: "image/*", class: "pick-image-button" })), h("div", { class: "shutter", onClick: this.handleShutterClick }, h("div", { class: "shutter-button" })), h("div", { class: "rotate", onClick: this.handleRotateClick }, h("img", { src: this.iconReverseCamera() }))] : h("section", { class: "items" }, h("div", { class: "item accept-cancel", onClick: function(t2) {
          return e2.handleCancelPhoto(t2);
        } }, h("img", { src: this.iconRetake() })), h("div", { class: "item accept-use", onClick: function(t2) {
          return e2.handleAcceptPhoto(t2);
        } }, h("img", { src: this.iconConfirm() })))));
      };
      Object.defineProperty(e, "assetsDirs", { get: function() {
        return ["icons"];
      }, enumerable: false, configurable: true });
      Object.defineProperty(e.prototype, "el", { get: function() {
        return getElement(this);
      }, enumerable: false, configurable: true });
      return e;
    })();
    CameraPWA.style = cameraCss;
  }
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/index-1c5c47b4.js
function queryNonceMetaTagContent(e) {
  var t, n, r;
  return (r = (n = (t = e.head) === null || t === void 0 ? void 0 : t.querySelector('meta[name="csp-nonce"]')) === null || n === void 0 ? void 0 : n.getAttribute("content")) !== null && r !== void 0 ? r : void 0;
}
var __extends, __awaiter4, __generator4, __spreadArray, NAMESPACE, scopeId, hostTagName, isSvgMode, queuePending, createTime, uniqueTime, HYDRATED_CSS, EMPTY_OBJ, SVG_NS, HTML_NS, isDef, isComplexType, h, newVNode, Host, isHost, parsePropertyValue, getElement, createEvent, emitEvent, rootAppliedStyles, registerStyle, addStyle, attachStyles, getScopeId, setAccessor, parseClassListRegex, parseClassList, updateElement, createElm, addVnodes, removeVnodes, updateChildren, isSameVnode, patch, nullifyVNodeRefs, renderVdom, attachToAncestor, scheduleUpdate, dispatchHooks, enqueue, isPromisey, updateComponent, callRender, postUpdateComponent, forceUpdate, appDidLoad, safeCall, addHydratedFlag, getValue, setValue, proxyComponent, initializeComponent, connectedCallback, disconnectedCallback, bootstrapLazy, addHostEventListeners, hostListenerProxy, getHostListenerTarget, hostListenerOpts, hostRefs, getHostRef, registerInstance, registerHost, isMemberInElement, consoleError, cmpModules, loadModule, styles, win, doc, plt, promiseResolve, supportsConstructableStylesheets, queueDomReads, queueDomWrites, queueTask, consume, flush, nextTick, writeTask;
var init_index_1c5c47b4 = __esm({
  "node_modules/@ionic/pwa-elements/dist/esm-es5/index-1c5c47b4.js"() {
    __extends = /* @__PURE__ */ (function() {
      var e = function(t, n) {
        e = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(e2, t2) {
          e2.__proto__ = t2;
        } || function(e2, t2) {
          for (var n2 in t2) if (Object.prototype.hasOwnProperty.call(t2, n2)) e2[n2] = t2[n2];
        };
        return e(t, n);
      };
      return function(t, n) {
        if (typeof n !== "function" && n !== null) throw new TypeError("Class extends value " + String(n) + " is not a constructor or null");
        e(t, n);
        function r() {
          this.constructor = t;
        }
        t.prototype = n === null ? Object.create(n) : (r.prototype = n.prototype, new r());
      };
    })();
    __awaiter4 = function(e, t, n, r) {
      function a(e2) {
        return e2 instanceof n ? e2 : new n((function(t2) {
          t2(e2);
        }));
      }
      return new (n || (n = Promise))((function(n2, o) {
        function s(e2) {
          try {
            l(r.next(e2));
          } catch (e3) {
            o(e3);
          }
        }
        function i(e2) {
          try {
            l(r["throw"](e2));
          } catch (e3) {
            o(e3);
          }
        }
        function l(e2) {
          e2.done ? n2(e2.value) : a(e2.value).then(s, i);
        }
        l((r = r.apply(e, t || [])).next());
      }));
    };
    __generator4 = function(e, t) {
      var n = { label: 0, sent: function() {
        if (o[0] & 1) throw o[1];
        return o[1];
      }, trys: [], ops: [] }, r, a, o, s;
      return s = { next: i(0), throw: i(1), return: i(2) }, typeof Symbol === "function" && (s[Symbol.iterator] = function() {
        return this;
      }), s;
      function i(e2) {
        return function(t2) {
          return l([e2, t2]);
        };
      }
      function l(i2) {
        if (r) throw new TypeError("Generator is already executing.");
        while (s && (s = 0, i2[0] && (n = 0)), n) try {
          if (r = 1, a && (o = i2[0] & 2 ? a["return"] : i2[0] ? a["throw"] || ((o = a["return"]) && o.call(a), 0) : a.next) && !(o = o.call(a, i2[1])).done) return o;
          if (a = 0, o) i2 = [i2[0] & 2, o.value];
          switch (i2[0]) {
            case 0:
            case 1:
              o = i2;
              break;
            case 4:
              n.label++;
              return { value: i2[1], done: false };
            case 5:
              n.label++;
              a = i2[1];
              i2 = [0];
              continue;
            case 7:
              i2 = n.ops.pop();
              n.trys.pop();
              continue;
            default:
              if (!(o = n.trys, o = o.length > 0 && o[o.length - 1]) && (i2[0] === 6 || i2[0] === 2)) {
                n = 0;
                continue;
              }
              if (i2[0] === 3 && (!o || i2[1] > o[0] && i2[1] < o[3])) {
                n.label = i2[1];
                break;
              }
              if (i2[0] === 6 && n.label < o[1]) {
                n.label = o[1];
                o = i2;
                break;
              }
              if (o && n.label < o[2]) {
                n.label = o[2];
                n.ops.push(i2);
                break;
              }
              if (o[2]) n.ops.pop();
              n.trys.pop();
              continue;
          }
          i2 = t.call(e, n);
        } catch (e2) {
          i2 = [6, e2];
          a = 0;
        } finally {
          r = o = 0;
        }
        if (i2[0] & 5) throw i2[1];
        return { value: i2[0] ? i2[1] : void 0, done: true };
      }
    };
    __spreadArray = function(e, t, n) {
      if (n || arguments.length === 2) for (var r = 0, a = t.length, o; r < a; r++) {
        if (o || !(r in t)) {
          if (!o) o = Array.prototype.slice.call(t, 0, r);
          o[r] = t[r];
        }
      }
      return e.concat(o || Array.prototype.slice.call(t));
    };
    NAMESPACE = "ionicpwaelements";
    isSvgMode = false;
    queuePending = false;
    createTime = function(e, t) {
      if (t === void 0) {
        t = "";
      }
      {
        return function() {
          return;
        };
      }
    };
    uniqueTime = function(e, t) {
      {
        return function() {
          return;
        };
      }
    };
    HYDRATED_CSS = "{visibility:hidden}.hydrated{visibility:inherit}";
    EMPTY_OBJ = {};
    SVG_NS = "http://www.w3.org/2000/svg";
    HTML_NS = "http://www.w3.org/1999/xhtml";
    isDef = function(e) {
      return e != null;
    };
    isComplexType = function(e) {
      e = typeof e;
      return e === "object" || e === "function";
    };
    h = function(e, t) {
      var n = [];
      for (var r = 2; r < arguments.length; r++) {
        n[r - 2] = arguments[r];
      }
      var a = null;
      var o = false;
      var s = false;
      var i = [];
      var l = function(t2) {
        for (var n2 = 0; n2 < t2.length; n2++) {
          a = t2[n2];
          if (Array.isArray(a)) {
            l(a);
          } else if (a != null && typeof a !== "boolean") {
            if (o = typeof e !== "function" && !isComplexType(a)) {
              a = String(a);
            }
            if (o && s) {
              i[i.length - 1].$text$ += a;
            } else {
              i.push(o ? newVNode(null, a) : a);
            }
            s = o;
          }
        }
      };
      l(n);
      if (t) {
        {
          var u = t.className || t.class;
          if (u) {
            t.class = typeof u !== "object" ? u : Object.keys(u).filter((function(e2) {
              return u[e2];
            })).join(" ");
          }
        }
      }
      var c = newVNode(e, null);
      c.$attrs$ = t;
      if (i.length > 0) {
        c.$children$ = i;
      }
      return c;
    };
    newVNode = function(e, t) {
      var n = { $flags$: 0, $tag$: e, $text$: t, $elm$: null, $children$: null };
      {
        n.$attrs$ = null;
      }
      return n;
    };
    Host = {};
    isHost = function(e) {
      return e && e.$tag$ === Host;
    };
    parsePropertyValue = function(e, t) {
      if (e != null && !isComplexType(e)) {
        if (t & 4) {
          return e === "false" ? false : e === "" || !!e;
        }
        if (t & 2) {
          return parseFloat(e);
        }
        if (t & 1) {
          return String(e);
        }
        return e;
      }
      return e;
    };
    getElement = function(e) {
      return getHostRef(e).$hostElement$;
    };
    createEvent = function(e, t, n) {
      var r = getElement(e);
      return { emit: function(e2) {
        return emitEvent(r, t, { bubbles: !!(n & 4), composed: !!(n & 2), cancelable: !!(n & 1), detail: e2 });
      } };
    };
    emitEvent = function(e, t, n) {
      var r = plt.ce(t, n);
      e.dispatchEvent(r);
      return r;
    };
    rootAppliedStyles = /* @__PURE__ */ new WeakMap();
    registerStyle = function(e, t, n) {
      var r = styles.get(e);
      if (supportsConstructableStylesheets && n) {
        r = r || new CSSStyleSheet();
        if (typeof r === "string") {
          r = t;
        } else {
          r.replaceSync(t);
        }
      } else {
        r = t;
      }
      styles.set(e, r);
    };
    addStyle = function(e, t, n, r) {
      var a;
      var o = getScopeId(t);
      var s = styles.get(o);
      e = e.nodeType === 11 ? e : doc;
      if (s) {
        if (typeof s === "string") {
          e = e.head || e;
          var i = rootAppliedStyles.get(e);
          var l = void 0;
          if (!i) {
            rootAppliedStyles.set(e, i = /* @__PURE__ */ new Set());
          }
          if (!i.has(o)) {
            {
              {
                l = doc.createElement("style");
                l.innerHTML = s;
              }
              var u = (a = plt.$nonce$) !== null && a !== void 0 ? a : queryNonceMetaTagContent(doc);
              if (u != null) {
                l.setAttribute("nonce", u);
              }
              e.insertBefore(l, e.querySelector("link"));
            }
            if (i) {
              i.add(o);
            }
          }
        } else if (!e.adoptedStyleSheets.includes(s)) {
          e.adoptedStyleSheets = __spreadArray(__spreadArray([], e.adoptedStyleSheets, true), [s], false);
        }
      }
      return o;
    };
    attachStyles = function(e) {
      var t = e.$cmpMeta$;
      var n = e.$hostElement$;
      var r = t.$flags$;
      var a = createTime("attachStyles", t.$tagName$);
      var o = addStyle(n.shadowRoot ? n.shadowRoot : n.getRootNode(), t);
      if (r & 10) {
        n["s-sc"] = o;
        n.classList.add(o + "-h");
      }
      a();
    };
    getScopeId = function(e, t) {
      return "sc-" + e.$tagName$;
    };
    setAccessor = function(e, t, n, r, a, o) {
      if (n !== r) {
        var s = isMemberInElement(e, t);
        var i = t.toLowerCase();
        if (t === "class") {
          var l = e.classList;
          var u = parseClassList(n);
          var c = parseClassList(r);
          l.remove.apply(l, u.filter((function(e2) {
            return e2 && !c.includes(e2);
          })));
          l.add.apply(l, c.filter((function(e2) {
            return e2 && !u.includes(e2);
          })));
        } else if (t === "style") {
          {
            for (var f in n) {
              if (!r || r[f] == null) {
                if (f.includes("-")) {
                  e.style.removeProperty(f);
                } else {
                  e.style[f] = "";
                }
              }
            }
          }
          for (var f in r) {
            if (!n || r[f] !== n[f]) {
              if (f.includes("-")) {
                e.style.setProperty(f, r[f]);
              } else {
                e.style[f] = r[f];
              }
            }
          }
        } else if (t === "ref") {
          if (r) {
            r(e);
          }
        } else if (!s && t[0] === "o" && t[1] === "n") {
          if (t[2] === "-") {
            t = t.slice(3);
          } else if (isMemberInElement(win, i)) {
            t = i.slice(2);
          } else {
            t = i[2] + t.slice(3);
          }
          if (n) {
            plt.rel(e, t, n, false);
          }
          if (r) {
            plt.ael(e, t, r, false);
          }
        } else {
          var $ = isComplexType(r);
          if ((s || $ && r !== null) && !a) {
            try {
              if (!e.tagName.includes("-")) {
                var d = r == null ? "" : r;
                if (t === "list") {
                  s = false;
                } else if (n == null || e[t] != d) {
                  e[t] = d;
                }
              } else {
                e[t] = r;
              }
            } catch (e2) {
            }
          }
          if (r == null || r === false) {
            if (r !== false || e.getAttribute(t) === "") {
              {
                e.removeAttribute(t);
              }
            }
          } else if ((!s || o & 4 || a) && !$) {
            r = r === true ? "" : r;
            {
              e.setAttribute(t, r);
            }
          }
        }
      }
    };
    parseClassListRegex = /\s/;
    parseClassList = function(e) {
      return !e ? [] : e.split(parseClassListRegex);
    };
    updateElement = function(e, t, n, r) {
      var a = t.$elm$.nodeType === 11 && t.$elm$.host ? t.$elm$.host : t.$elm$;
      var o = e && e.$attrs$ || EMPTY_OBJ;
      var s = t.$attrs$ || EMPTY_OBJ;
      {
        for (r in o) {
          if (!(r in s)) {
            setAccessor(a, r, o[r], void 0, n, t.$flags$);
          }
        }
      }
      for (r in s) {
        setAccessor(a, r, o[r], s[r], n, t.$flags$);
      }
    };
    createElm = function(e, t, n, r) {
      var a = t.$children$[n];
      var o = 0;
      var s;
      var i;
      if (a.$text$ !== null) {
        s = a.$elm$ = doc.createTextNode(a.$text$);
      } else {
        if (!isSvgMode) {
          isSvgMode = a.$tag$ === "svg";
        }
        s = a.$elm$ = doc.createElementNS(isSvgMode ? SVG_NS : HTML_NS, a.$tag$);
        if (isSvgMode && a.$tag$ === "foreignObject") {
          isSvgMode = false;
        }
        {
          updateElement(null, a, isSvgMode);
        }
        if (isDef(scopeId) && s["s-si"] !== scopeId) {
          s.classList.add(s["s-si"] = scopeId);
        }
        if (a.$children$) {
          for (o = 0; o < a.$children$.length; ++o) {
            i = createElm(e, a, o);
            if (i) {
              s.appendChild(i);
            }
          }
        }
        {
          if (a.$tag$ === "svg") {
            isSvgMode = false;
          } else if (s.tagName === "foreignObject") {
            isSvgMode = true;
          }
        }
      }
      return s;
    };
    addVnodes = function(e, t, n, r, a, o) {
      var s = e;
      var i;
      if (s.shadowRoot && s.tagName === hostTagName) {
        s = s.shadowRoot;
      }
      for (; a <= o; ++a) {
        if (r[a]) {
          i = createElm(null, n, a);
          if (i) {
            r[a].$elm$ = i;
            s.insertBefore(i, t);
          }
        }
      }
    };
    removeVnodes = function(e, t, n) {
      for (var r = t; r <= n; ++r) {
        var a = e[r];
        if (a) {
          var o = a.$elm$;
          nullifyVNodeRefs(a);
          if (o) {
            o.remove();
          }
        }
      }
    };
    updateChildren = function(e, t, n, r) {
      var a = 0;
      var o = 0;
      var s = t.length - 1;
      var i = t[0];
      var l = t[s];
      var u = r.length - 1;
      var c = r[0];
      var f = r[u];
      var $;
      while (a <= s && o <= u) {
        if (i == null) {
          i = t[++a];
        } else if (l == null) {
          l = t[--s];
        } else if (c == null) {
          c = r[++o];
        } else if (f == null) {
          f = r[--u];
        } else if (isSameVnode(i, c)) {
          patch(i, c);
          i = t[++a];
          c = r[++o];
        } else if (isSameVnode(l, f)) {
          patch(l, f);
          l = t[--s];
          f = r[--u];
        } else if (isSameVnode(i, f)) {
          patch(i, f);
          e.insertBefore(i.$elm$, l.$elm$.nextSibling);
          i = t[++a];
          f = r[--u];
        } else if (isSameVnode(l, c)) {
          patch(l, c);
          e.insertBefore(l.$elm$, i.$elm$);
          l = t[--s];
          c = r[++o];
        } else {
          {
            $ = createElm(t && t[o], n, o);
            c = r[++o];
          }
          if ($) {
            {
              i.$elm$.parentNode.insertBefore($, i.$elm$);
            }
          }
        }
      }
      if (a > s) {
        addVnodes(e, r[u + 1] == null ? null : r[u + 1].$elm$, n, r, o, u);
      } else if (o > u) {
        removeVnodes(t, a, s);
      }
    };
    isSameVnode = function(e, t) {
      if (e.$tag$ === t.$tag$) {
        return true;
      }
      return false;
    };
    patch = function(e, t) {
      var n = t.$elm$ = e.$elm$;
      var r = e.$children$;
      var a = t.$children$;
      var o = t.$tag$;
      var s = t.$text$;
      if (s === null) {
        {
          isSvgMode = o === "svg" ? true : o === "foreignObject" ? false : isSvgMode;
        }
        {
          {
            updateElement(e, t, isSvgMode);
          }
        }
        if (r !== null && a !== null) {
          updateChildren(n, r, t, a);
        } else if (a !== null) {
          if (e.$text$ !== null) {
            n.textContent = "";
          }
          addVnodes(n, null, t, a, 0, a.length - 1);
        } else if (r !== null) {
          removeVnodes(r, 0, r.length - 1);
        }
        if (isSvgMode && o === "svg") {
          isSvgMode = false;
        }
      } else if (e.$text$ !== s) {
        n.data = s;
      }
    };
    nullifyVNodeRefs = function(e) {
      {
        e.$attrs$ && e.$attrs$.ref && e.$attrs$.ref(null);
        e.$children$ && e.$children$.map(nullifyVNodeRefs);
      }
    };
    renderVdom = function(e, t) {
      var n = e.$hostElement$;
      var r = e.$vnode$ || newVNode(null, null);
      var a = isHost(t) ? t : h(null, null, t);
      hostTagName = n.tagName;
      a.$tag$ = null;
      a.$flags$ |= 4;
      e.$vnode$ = a;
      a.$elm$ = r.$elm$ = n.shadowRoot || n;
      {
        scopeId = n["s-sc"];
      }
      patch(r, a);
    };
    attachToAncestor = function(e, t) {
      if (t && !e.$onRenderResolve$ && t["s-p"]) {
        t["s-p"].push(new Promise((function(t2) {
          return e.$onRenderResolve$ = t2;
        })));
      }
    };
    scheduleUpdate = function(e, t) {
      {
        e.$flags$ |= 16;
      }
      if (e.$flags$ & 4) {
        e.$flags$ |= 512;
        return;
      }
      attachToAncestor(e, e.$ancestorComponent$);
      var n = function() {
        return dispatchHooks(e, t);
      };
      return writeTask(n);
    };
    dispatchHooks = function(e, t) {
      var n = createTime("scheduleUpdate", e.$cmpMeta$.$tagName$);
      var r = e.$lazyInstance$;
      var a;
      if (t) {
        {
          e.$flags$ |= 256;
          if (e.$queuedListeners$) {
            e.$queuedListeners$.map((function(e2) {
              var t2 = e2[0], n2 = e2[1];
              return safeCall(r, t2, n2);
            }));
            e.$queuedListeners$ = void 0;
          }
        }
      }
      n();
      return enqueue(a, (function() {
        return updateComponent(e, r, t);
      }));
    };
    enqueue = function(e, t) {
      return isPromisey(e) ? e.then(t) : t();
    };
    isPromisey = function(e) {
      return e instanceof Promise || e && e.then && typeof e.then === "function";
    };
    updateComponent = function(e, t, n) {
      return __awaiter4(void 0, void 0, void 0, (function() {
        var r, a, o, s, i, l, u;
        return __generator4(this, (function(c) {
          a = e.$hostElement$;
          o = createTime("update", e.$cmpMeta$.$tagName$);
          s = a["s-rc"];
          if (n) {
            attachStyles(e);
          }
          i = createTime("render", e.$cmpMeta$.$tagName$);
          {
            callRender(e, t);
          }
          if (s) {
            s.map((function(e2) {
              return e2();
            }));
            a["s-rc"] = void 0;
          }
          i();
          o();
          {
            l = (r = a["s-p"]) !== null && r !== void 0 ? r : [];
            u = function() {
              return postUpdateComponent(e);
            };
            if (l.length === 0) {
              u();
            } else {
              Promise.all(l).then(u);
              e.$flags$ |= 4;
              l.length = 0;
            }
          }
          return [2];
        }));
      }));
    };
    callRender = function(e, t, n) {
      try {
        t = t.render();
        {
          e.$flags$ &= ~16;
        }
        {
          e.$flags$ |= 2;
        }
        {
          {
            {
              renderVdom(e, t);
            }
          }
        }
      } catch (t2) {
        consoleError(t2, e.$hostElement$);
      }
      return null;
    };
    postUpdateComponent = function(e) {
      var t = e.$cmpMeta$.$tagName$;
      var n = e.$hostElement$;
      var r = createTime("postUpdate", t);
      var a = e.$lazyInstance$;
      var o = e.$ancestorComponent$;
      if (!(e.$flags$ & 64)) {
        e.$flags$ |= 64;
        {
          addHydratedFlag(n);
        }
        {
          safeCall(a, "componentDidLoad");
        }
        r();
        {
          e.$onReadyResolve$(n);
          if (!o) {
            appDidLoad();
          }
        }
      } else {
        r();
      }
      {
        e.$onInstanceResolve$(n);
      }
      {
        if (e.$onRenderResolve$) {
          e.$onRenderResolve$();
          e.$onRenderResolve$ = void 0;
        }
        if (e.$flags$ & 512) {
          nextTick((function() {
            return scheduleUpdate(e, false);
          }));
        }
        e.$flags$ &= ~(4 | 512);
      }
    };
    forceUpdate = function(e) {
      {
        var t = getHostRef(e);
        var n = t.$hostElement$.isConnected;
        if (n && (t.$flags$ & (2 | 16)) === 2) {
          scheduleUpdate(t, false);
        }
        return n;
      }
    };
    appDidLoad = function(e) {
      {
        addHydratedFlag(doc.documentElement);
      }
      nextTick((function() {
        return emitEvent(win, "appload", { detail: { namespace: NAMESPACE } });
      }));
    };
    safeCall = function(e, t, n) {
      if (e && e[t]) {
        try {
          return e[t](n);
        } catch (e2) {
          consoleError(e2);
        }
      }
      return void 0;
    };
    addHydratedFlag = function(e) {
      return e.classList.add("hydrated");
    };
    getValue = function(e, t) {
      return getHostRef(e).$instanceValues$.get(t);
    };
    setValue = function(e, t, n, r) {
      var a = getHostRef(e);
      var o = a.$instanceValues$.get(t);
      var s = a.$flags$;
      var i = a.$lazyInstance$;
      n = parsePropertyValue(n, r.$members$[t][0]);
      var l = Number.isNaN(o) && Number.isNaN(n);
      var u = n !== o && !l;
      if ((!(s & 8) || o === void 0) && u) {
        a.$instanceValues$.set(t, n);
        if (i) {
          if ((s & (2 | 16)) === 2) {
            scheduleUpdate(a, false);
          }
        }
      }
    };
    proxyComponent = function(e, t, n) {
      if (t.$members$) {
        var r = Object.entries(t.$members$);
        var a = e.prototype;
        r.map((function(e2) {
          var r2 = e2[0], o2 = e2[1][0];
          if (o2 & 31 || n & 2 && o2 & 32) {
            Object.defineProperty(a, r2, { get: function() {
              return getValue(this, r2);
            }, set: function(e3) {
              setValue(this, r2, e3, t);
            }, configurable: true, enumerable: true });
          } else if (n & 1 && o2 & 64) {
            Object.defineProperty(a, r2, { value: function() {
              var e3 = [];
              for (var t2 = 0; t2 < arguments.length; t2++) {
                e3[t2] = arguments[t2];
              }
              var n2 = getHostRef(this);
              return n2.$onInstancePromise$.then((function() {
                var t3;
                return (t3 = n2.$lazyInstance$)[r2].apply(t3, e3);
              }));
            } });
          }
        }));
        if (n & 1) {
          var o = /* @__PURE__ */ new Map();
          a.attributeChangedCallback = function(e2, t2, n2) {
            var r2 = this;
            plt.jmp((function() {
              var t3 = o.get(e2);
              if (r2.hasOwnProperty(t3)) {
                n2 = r2[t3];
                delete r2[t3];
              } else if (a.hasOwnProperty(t3) && typeof r2[t3] === "number" && r2[t3] == n2) {
                return;
              }
              r2[t3] = n2 === null && typeof r2[t3] === "boolean" ? false : n2;
            }));
          };
          e.observedAttributes = r.filter((function(e2) {
            var t2 = e2[0], n2 = e2[1];
            return n2[0] & 15;
          })).map((function(e2) {
            var t2 = e2[0], n2 = e2[1];
            var r2 = n2[1] || t2;
            o.set(r2, t2);
            return r2;
          }));
        }
      }
      return e;
    };
    initializeComponent = function(e, t, n, r, a) {
      return __awaiter4(void 0, void 0, void 0, (function() {
        var e2, r2, o, s, i, l, u;
        return __generator4(this, (function(c) {
          switch (c.label) {
            case 0:
              if (!((t.$flags$ & 32) === 0)) return [3, 3];
              t.$flags$ |= 32;
              a = loadModule(n);
              if (!a.then) return [3, 2];
              e2 = uniqueTime();
              return [4, a];
            case 1:
              a = c.sent();
              e2();
              c.label = 2;
            case 2:
              if (!a.isProxied) {
                proxyComponent(a, n, 2);
                a.isProxied = true;
              }
              r2 = createTime("createInstance", n.$tagName$);
              {
                t.$flags$ |= 8;
              }
              try {
                new a(t);
              } catch (e3) {
                consoleError(e3);
              }
              {
                t.$flags$ &= ~8;
              }
              r2();
              if (a.style) {
                o = a.style;
                s = getScopeId(n);
                if (!styles.has(s)) {
                  i = createTime("registerStyles", n.$tagName$);
                  registerStyle(s, o, !!(n.$flags$ & 1));
                  i();
                }
              }
              c.label = 3;
            case 3:
              l = t.$ancestorComponent$;
              u = function() {
                return scheduleUpdate(t, true);
              };
              if (l && l["s-rc"]) {
                l["s-rc"].push(u);
              } else {
                u();
              }
              return [2];
          }
        }));
      }));
    };
    connectedCallback = function(e) {
      if ((plt.$flags$ & 1) === 0) {
        var t = getHostRef(e);
        var n = t.$cmpMeta$;
        var r = createTime("connectedCallback", n.$tagName$);
        if (!(t.$flags$ & 1)) {
          t.$flags$ |= 1;
          {
            var a = e;
            while (a = a.parentNode || a.host) {
              if (a["s-p"]) {
                attachToAncestor(t, t.$ancestorComponent$ = a);
                break;
              }
            }
          }
          if (n.$members$) {
            Object.entries(n.$members$).map((function(t2) {
              var n2 = t2[0], r2 = t2[1][0];
              if (r2 & 31 && e.hasOwnProperty(n2)) {
                var a2 = e[n2];
                delete e[n2];
                e[n2] = a2;
              }
            }));
          }
          {
            initializeComponent(e, t, n);
          }
        } else {
          addHostEventListeners(e, t, n.$listeners$);
        }
        r();
      }
    };
    disconnectedCallback = function(e) {
      if ((plt.$flags$ & 1) === 0) {
        var t = getHostRef(e);
        var n = t.$lazyInstance$;
        {
          if (t.$rmListeners$) {
            t.$rmListeners$.map((function(e2) {
              return e2();
            }));
            t.$rmListeners$ = void 0;
          }
        }
        {
          safeCall(n, "disconnectedCallback");
        }
      }
    };
    bootstrapLazy = function(e, t) {
      if (t === void 0) {
        t = {};
      }
      var n;
      var r = createTime();
      var a = [];
      var o = t.exclude || [];
      var s = win.customElements;
      var i = doc.head;
      var l = i.querySelector("meta[charset]");
      var u = doc.createElement("style");
      var c = [];
      var f;
      var $ = true;
      Object.assign(plt, t);
      plt.$resourcesUrl$ = new URL(t.resourcesUrl || "./", doc.baseURI).href;
      e.map((function(e2) {
        e2[1].map((function(t2) {
          var n2 = { $flags$: t2[0], $tagName$: t2[1], $members$: t2[2], $listeners$: t2[3] };
          {
            n2.$members$ = t2[2];
          }
          {
            n2.$listeners$ = t2[3];
          }
          var r2 = n2.$tagName$;
          var i2 = (function(e3) {
            __extends(t3, e3);
            function t3(t4) {
              var r3 = e3.call(this, t4) || this;
              t4 = r3;
              registerHost(t4, n2);
              if (n2.$flags$ & 1) {
                {
                  {
                    t4.attachShadow({ mode: "open" });
                  }
                }
              }
              return r3;
            }
            t3.prototype.connectedCallback = function() {
              var e4 = this;
              if (f) {
                clearTimeout(f);
                f = null;
              }
              if ($) {
                c.push(this);
              } else {
                plt.jmp((function() {
                  return connectedCallback(e4);
                }));
              }
            };
            t3.prototype.disconnectedCallback = function() {
              var e4 = this;
              plt.jmp((function() {
                return disconnectedCallback(e4);
              }));
            };
            t3.prototype.componentOnReady = function() {
              return getHostRef(this).$onReadyPromise$;
            };
            return t3;
          })(HTMLElement);
          n2.$lazyBundleId$ = e2[0];
          if (!o.includes(r2) && !s.get(r2)) {
            a.push(r2);
            s.define(r2, proxyComponent(i2, n2, 1));
          }
        }));
      }));
      {
        u.innerHTML = a + HYDRATED_CSS;
        u.setAttribute("data-styles", "");
        var d = (n = plt.$nonce$) !== null && n !== void 0 ? n : queryNonceMetaTagContent(doc);
        if (d != null) {
          u.setAttribute("nonce", d);
        }
        i.insertBefore(u, l ? l.nextSibling : i.firstChild);
      }
      $ = false;
      if (c.length) {
        c.map((function(e2) {
          return e2.connectedCallback();
        }));
      } else {
        {
          plt.jmp((function() {
            return f = setTimeout(appDidLoad, 30);
          }));
        }
      }
      r();
    };
    addHostEventListeners = function(e, t, n, r) {
      if (n) {
        n.map((function(n2) {
          var r2 = n2[0], a = n2[1], o = n2[2];
          var s = getHostListenerTarget(e, r2);
          var i = hostListenerProxy(t, o);
          var l = hostListenerOpts(r2);
          plt.ael(s, a, i, l);
          (t.$rmListeners$ = t.$rmListeners$ || []).push((function() {
            return plt.rel(s, a, i, l);
          }));
        }));
      }
    };
    hostListenerProxy = function(e, t) {
      return function(n) {
        try {
          {
            if (e.$flags$ & 256) {
              e.$lazyInstance$[t](n);
            } else {
              (e.$queuedListeners$ = e.$queuedListeners$ || []).push([t, n]);
            }
          }
        } catch (e2) {
          consoleError(e2);
        }
      };
    };
    getHostListenerTarget = function(e, t) {
      if (t & 16) return doc.body;
      return e;
    };
    hostListenerOpts = function(e) {
      return (e & 2) !== 0;
    };
    hostRefs = /* @__PURE__ */ new WeakMap();
    getHostRef = function(e) {
      return hostRefs.get(e);
    };
    registerInstance = function(e, t) {
      return hostRefs.set(t.$lazyInstance$ = e, t);
    };
    registerHost = function(e, t) {
      var n = { $flags$: 0, $hostElement$: e, $cmpMeta$: t, $instanceValues$: /* @__PURE__ */ new Map() };
      {
        n.$onInstancePromise$ = new Promise((function(e2) {
          return n.$onInstanceResolve$ = e2;
        }));
      }
      {
        n.$onReadyPromise$ = new Promise((function(e2) {
          return n.$onReadyResolve$ = e2;
        }));
        e["s-p"] = [];
        e["s-rc"] = [];
      }
      addHostEventListeners(e, n, t.$listeners$);
      return hostRefs.set(e, n);
    };
    isMemberInElement = function(e, t) {
      return t in e;
    };
    consoleError = function(e, t) {
      return (0, console.error)(e, t);
    };
    cmpModules = /* @__PURE__ */ new Map();
    loadModule = function(e, t, n) {
      var r = e.$tagName$.replace(/-/g, "_");
      var a = e.$lazyBundleId$;
      var o = cmpModules.get(a);
      if (o) {
        return o[r];
      }
      if (!n || !BUILD.hotModuleReplacement) {
        var s = function(e2) {
          cmpModules.set(a, e2);
          return e2[r];
        };
        switch (a) {
          case "pwa-action-sheet":
            return Promise.resolve().then(() => (init_pwa_action_sheet_entry(), pwa_action_sheet_entry_exports)).then(s, consoleError);
          case "pwa-camera-modal":
            return Promise.resolve().then(() => (init_pwa_camera_modal_entry(), pwa_camera_modal_entry_exports)).then(s, consoleError);
          case "pwa-toast":
            return Promise.resolve().then(() => (init_pwa_toast_entry(), pwa_toast_entry_exports)).then(s, consoleError);
          case "pwa-camera-modal-instance":
            return Promise.resolve().then(() => (init_pwa_camera_modal_instance_entry(), pwa_camera_modal_instance_entry_exports)).then(s, consoleError);
          case "pwa-camera":
            return Promise.resolve().then(() => (init_pwa_camera_entry(), pwa_camera_entry_exports)).then(s, consoleError);
        }
      }
      return import("./".concat(a, ".entry.js").concat("")).then((function(e2) {
        {
          cmpModules.set(a, e2);
        }
        return e2[r];
      }), consoleError);
    };
    styles = /* @__PURE__ */ new Map();
    win = typeof window !== "undefined" ? window : {};
    doc = win.document || { head: {} };
    plt = { $flags$: 0, $resourcesUrl$: "", jmp: function(e) {
      return e();
    }, raf: function(e) {
      return requestAnimationFrame(e);
    }, ael: function(e, t, n, r) {
      return e.addEventListener(t, n, r);
    }, rel: function(e, t, n, r) {
      return e.removeEventListener(t, n, r);
    }, ce: function(e, t) {
      return new CustomEvent(e, t);
    } };
    promiseResolve = function(e) {
      return Promise.resolve(e);
    };
    supportsConstructableStylesheets = (function() {
      try {
        new CSSStyleSheet();
        return typeof new CSSStyleSheet().replaceSync === "function";
      } catch (e) {
      }
      return false;
    })();
    queueDomReads = [];
    queueDomWrites = [];
    queueTask = function(e, t) {
      return function(n) {
        e.push(n);
        if (!queuePending) {
          queuePending = true;
          if (t && plt.$flags$ & 4) {
            nextTick(flush);
          } else {
            plt.raf(flush);
          }
        }
      };
    };
    consume = function(e) {
      for (var t = 0; t < e.length; t++) {
        try {
          e[t](performance.now());
        } catch (e2) {
          consoleError(e2);
        }
      }
      e.length = 0;
    };
    flush = function() {
      consume(queueDomReads);
      {
        consume(queueDomWrites);
        if (queuePending = queueDomReads.length > 0) {
          plt.raf(flush);
        }
      }
    };
    nextTick = function(e) {
      return promiseResolve().then(e);
    };
    writeTask = queueTask(queueDomWrites, true);
  }
});

// node_modules/@capacitor/core/dist/index.js
var ExceptionCode;
(function(ExceptionCode2) {
  ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
  ExceptionCode2["Unavailable"] = "UNAVAILABLE";
})(ExceptionCode || (ExceptionCode = {}));
var CapacitorException = class extends Error {
  constructor(message, code, data) {
    super(message);
    this.message = message;
    this.code = code;
    this.data = data;
  }
};
var getPlatformId = (win2) => {
  var _a, _b;
  if (win2 === null || win2 === void 0 ? void 0 : win2.androidBridge) {
    return "android";
  } else if ((_b = (_a = win2 === null || win2 === void 0 ? void 0 : win2.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
    return "ios";
  } else {
    return "web";
  }
};
var createCapacitor = (win2) => {
  const capCustomPlatform = win2.CapacitorCustomPlatform || null;
  const cap = win2.Capacitor || {};
  const Plugins = cap.Plugins = cap.Plugins || {};
  const getPlatform = () => {
    return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win2);
  };
  const isNativePlatform = () => getPlatform() !== "web";
  const isPluginAvailable = (pluginName) => {
    const plugin = registeredPlugins.get(pluginName);
    if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
      return true;
    }
    if (getPluginHeader(pluginName)) {
      return true;
    }
    return false;
  };
  const getPluginHeader = (pluginName) => {
    var _a;
    return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h2) => h2.name === pluginName);
  };
  const handleError = (err) => win2.console.error(err);
  const registeredPlugins = /* @__PURE__ */ new Map();
  const registerPlugin2 = (pluginName, jsImplementations = {}) => {
    const registeredPlugin = registeredPlugins.get(pluginName);
    if (registeredPlugin) {
      console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
      return registeredPlugin.proxy;
    }
    const platform = getPlatform();
    const pluginHeader = getPluginHeader(pluginName);
    let jsImplementation;
    const loadPluginImplementation = async () => {
      if (!jsImplementation && platform in jsImplementations) {
        jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
      } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
        jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
      }
      return jsImplementation;
    };
    const createPluginMethod = (impl, prop) => {
      var _a, _b;
      if (pluginHeader) {
        const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
        if (methodHeader) {
          if (methodHeader.rtype === "promise") {
            return (options) => cap.nativePromise(pluginName, prop.toString(), options);
          } else {
            return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
          }
        } else if (impl) {
          return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
        }
      } else if (impl) {
        return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
      } else {
        throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
      }
    };
    const createPluginMethodWrapper = (prop) => {
      let remove;
      const wrapper = (...args) => {
        const p = loadPluginImplementation().then((impl) => {
          const fn = createPluginMethod(impl, prop);
          if (fn) {
            const p2 = fn(...args);
            remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
            return p2;
          } else {
            throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        });
        if (prop === "addListener") {
          p.remove = async () => remove();
        }
        return p;
      };
      wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
      Object.defineProperty(wrapper, "name", {
        value: prop,
        writable: false,
        configurable: false
      });
      return wrapper;
    };
    const addListener = createPluginMethodWrapper("addListener");
    const removeListener = createPluginMethodWrapper("removeListener");
    const addListenerNative = (eventName, callback) => {
      const call = addListener({ eventName }, callback);
      const remove = async () => {
        const callbackId = await call;
        removeListener({
          eventName,
          callbackId
        }, callback);
      };
      const p = new Promise((resolve) => call.then(() => resolve({ remove })));
      p.remove = async () => {
        console.warn(`Using addListener() without 'await' is deprecated.`);
        await remove();
      };
      return p;
    };
    const proxy = new Proxy({}, {
      get(_, prop) {
        switch (prop) {
          // https://github.com/facebook/react/issues/20030
          case "$$typeof":
            return void 0;
          case "toJSON":
            return () => ({});
          case "addListener":
            return pluginHeader ? addListenerNative : addListener;
          case "removeListener":
            return removeListener;
          default:
            return createPluginMethodWrapper(prop);
        }
      }
    });
    Plugins[pluginName] = proxy;
    registeredPlugins.set(pluginName, {
      name: pluginName,
      proxy,
      platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
    });
    return proxy;
  };
  if (!cap.convertFileSrc) {
    cap.convertFileSrc = (filePath) => filePath;
  }
  cap.getPlatform = getPlatform;
  cap.handleError = handleError;
  cap.isNativePlatform = isNativePlatform;
  cap.isPluginAvailable = isPluginAvailable;
  cap.registerPlugin = registerPlugin2;
  cap.Exception = CapacitorException;
  cap.DEBUG = !!cap.DEBUG;
  cap.isLoggingEnabled = !!cap.isLoggingEnabled;
  return cap;
};
var initCapacitorGlobal = (win2) => win2.Capacitor = createCapacitor(win2);
var Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
var registerPlugin = Capacitor.registerPlugin;
var WebPlugin = class {
  constructor() {
    this.listeners = {};
    this.retainedEventArguments = {};
    this.windowListeners = {};
  }
  addListener(eventName, listenerFunc) {
    let firstListener = false;
    const listeners = this.listeners[eventName];
    if (!listeners) {
      this.listeners[eventName] = [];
      firstListener = true;
    }
    this.listeners[eventName].push(listenerFunc);
    const windowListener = this.windowListeners[eventName];
    if (windowListener && !windowListener.registered) {
      this.addWindowListener(windowListener);
    }
    if (firstListener) {
      this.sendRetainedArgumentsForEvent(eventName);
    }
    const remove = async () => this.removeListener(eventName, listenerFunc);
    const p = Promise.resolve({ remove });
    return p;
  }
  async removeAllListeners() {
    this.listeners = {};
    for (const listener in this.windowListeners) {
      this.removeWindowListener(this.windowListeners[listener]);
    }
    this.windowListeners = {};
  }
  notifyListeners(eventName, data, retainUntilConsumed) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      if (retainUntilConsumed) {
        let args = this.retainedEventArguments[eventName];
        if (!args) {
          args = [];
        }
        args.push(data);
        this.retainedEventArguments[eventName] = args;
      }
      return;
    }
    listeners.forEach((listener) => listener(data));
  }
  hasListeners(eventName) {
    var _a;
    return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
  }
  registerWindowListener(windowEventName, pluginEventName) {
    this.windowListeners[pluginEventName] = {
      registered: false,
      windowEventName,
      pluginEventName,
      handler: (event) => {
        this.notifyListeners(pluginEventName, event);
      }
    };
  }
  unimplemented(msg = "not implemented") {
    return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
  }
  unavailable(msg = "not available") {
    return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
  }
  async removeListener(eventName, listenerFunc) {
    const listeners = this.listeners[eventName];
    if (!listeners) {
      return;
    }
    const index = listeners.indexOf(listenerFunc);
    this.listeners[eventName].splice(index, 1);
    if (!this.listeners[eventName].length) {
      this.removeWindowListener(this.windowListeners[eventName]);
    }
  }
  addWindowListener(handle) {
    window.addEventListener(handle.windowEventName, handle.handler);
    handle.registered = true;
  }
  removeWindowListener(handle) {
    if (!handle) {
      return;
    }
    window.removeEventListener(handle.windowEventName, handle.handler);
    handle.registered = false;
  }
  sendRetainedArgumentsForEvent(eventName) {
    const args = this.retainedEventArguments[eventName];
    if (!args) {
      return;
    }
    delete this.retainedEventArguments[eventName];
    args.forEach((arg) => {
      this.notifyListeners(eventName, arg);
    });
  }
};
var encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
var decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
var CapacitorCookiesPluginWeb = class extends WebPlugin {
  async getCookies() {
    const cookies = document.cookie;
    const cookieMap = {};
    cookies.split(";").forEach((cookie) => {
      if (cookie.length <= 0)
        return;
      let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
      key = decode(key).trim();
      value = decode(value).trim();
      cookieMap[key] = value;
    });
    return cookieMap;
  }
  async setCookie(options) {
    try {
      const encodedKey = encode(options.key);
      const encodedValue = encode(options.value);
      const expires = `; expires=${(options.expires || "").replace("expires=", "")}`;
      const path = (options.path || "/").replace("path=", "");
      const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
      document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async deleteCookie(options) {
    try {
      document.cookie = `${options.key}=; Max-Age=0`;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async clearCookies() {
    try {
      const cookies = document.cookie.split(";") || [];
      for (const cookie of cookies) {
        document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
  async clearAllCookies() {
    try {
      await this.clearCookies();
    } catch (error) {
      return Promise.reject(error);
    }
  }
};
var CapacitorCookies = registerPlugin("CapacitorCookies", {
  web: () => new CapacitorCookiesPluginWeb()
});
var readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const base64String = reader.result;
    resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
  };
  reader.onerror = (error) => reject(error);
  reader.readAsDataURL(blob);
});
var normalizeHttpHeaders = (headers = {}) => {
  const originalKeys = Object.keys(headers);
  const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
  const normalized = loweredKeys.reduce((acc, key, index) => {
    acc[key] = headers[originalKeys[index]];
    return acc;
  }, {});
  return normalized;
};
var buildUrlParams = (params, shouldEncode = true) => {
  if (!params)
    return null;
  const output = Object.entries(params).reduce((accumulator, entry) => {
    const [key, value] = entry;
    let encodedValue;
    let item;
    if (Array.isArray(value)) {
      item = "";
      value.forEach((str) => {
        encodedValue = shouldEncode ? encodeURIComponent(str) : str;
        item += `${key}=${encodedValue}&`;
      });
      item.slice(0, -1);
    } else {
      encodedValue = shouldEncode ? encodeURIComponent(value) : value;
      item = `${key}=${encodedValue}`;
    }
    return `${accumulator}&${item}`;
  }, "");
  return output.substr(1);
};
var buildRequestInit = (options, extra = {}) => {
  const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
  const headers = normalizeHttpHeaders(options.headers);
  const type = headers["content-type"] || "";
  if (typeof options.data === "string") {
    output.body = options.data;
  } else if (type.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.data || {})) {
      params.set(key, value);
    }
    output.body = params.toString();
  } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
    const form = new FormData();
    if (options.data instanceof FormData) {
      options.data.forEach((value, key) => {
        form.append(key, value);
      });
    } else {
      for (const key of Object.keys(options.data)) {
        form.append(key, options.data[key]);
      }
    }
    output.body = form;
    const headers2 = new Headers(output.headers);
    headers2.delete("content-type");
    output.headers = headers2;
  } else if (type.includes("application/json") || typeof options.data === "object") {
    output.body = JSON.stringify(options.data);
  }
  return output;
};
var CapacitorHttpPluginWeb = class extends WebPlugin {
  /**
   * Perform an Http request given a set of options
   * @param options Options to build the HTTP request
   */
  async request(options) {
    const requestInit = buildRequestInit(options, options.webFetchExtra);
    const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
    const url = urlParams ? `${options.url}?${urlParams}` : options.url;
    const response = await fetch(url, requestInit);
    const contentType = response.headers.get("content-type") || "";
    let { responseType = "text" } = response.ok ? options : {};
    if (contentType.includes("application/json")) {
      responseType = "json";
    }
    let data;
    let blob;
    switch (responseType) {
      case "arraybuffer":
      case "blob":
        blob = await response.blob();
        data = await readBlobAsBase64(blob);
        break;
      case "json":
        data = await response.json();
        break;
      case "document":
      case "text":
      default:
        data = await response.text();
    }
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      data,
      headers,
      status: response.status,
      url: response.url
    };
  }
  /**
   * Perform an Http GET request given a set of options
   * @param options Options to build the HTTP request
   */
  async get(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
  }
  /**
   * Perform an Http POST request given a set of options
   * @param options Options to build the HTTP request
   */
  async post(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
  }
  /**
   * Perform an Http PUT request given a set of options
   * @param options Options to build the HTTP request
   */
  async put(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
  }
  /**
   * Perform an Http PATCH request given a set of options
   * @param options Options to build the HTTP request
   */
  async patch(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
  }
  /**
   * Perform an Http DELETE request given a set of options
   * @param options Options to build the HTTP request
   */
  async delete(options) {
    return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
  }
};
var CapacitorHttp = registerPlugin("CapacitorHttp", {
  web: () => new CapacitorHttpPluginWeb()
});

// node_modules/@capacitor/camera/dist/esm/definitions.js
var CameraSource;
(function(CameraSource2) {
  CameraSource2["Prompt"] = "PROMPT";
  CameraSource2["Camera"] = "CAMERA";
  CameraSource2["Photos"] = "PHOTOS";
})(CameraSource || (CameraSource = {}));
var CameraDirection;
(function(CameraDirection2) {
  CameraDirection2["Rear"] = "REAR";
  CameraDirection2["Front"] = "FRONT";
})(CameraDirection || (CameraDirection = {}));
var CameraResultType;
(function(CameraResultType2) {
  CameraResultType2["Uri"] = "uri";
  CameraResultType2["Base64"] = "base64";
  CameraResultType2["DataUrl"] = "dataUrl";
})(CameraResultType || (CameraResultType = {}));

// node_modules/@capacitor/camera/dist/esm/web.js
var CameraWeb = class extends WebPlugin {
  async getPhoto(options) {
    return new Promise(async (resolve, reject) => {
      if (options.webUseInput || options.source === CameraSource.Photos) {
        this.fileInputExperience(options, resolve, reject);
      } else if (options.source === CameraSource.Prompt) {
        let actionSheet = document.querySelector("pwa-action-sheet");
        if (!actionSheet) {
          actionSheet = document.createElement("pwa-action-sheet");
          document.body.appendChild(actionSheet);
        }
        actionSheet.header = options.promptLabelHeader || "Photo";
        actionSheet.cancelable = false;
        actionSheet.options = [
          { title: options.promptLabelPhoto || "From Photos" },
          { title: options.promptLabelPicture || "Take Picture" }
        ];
        actionSheet.addEventListener("onSelection", async (e) => {
          const selection = e.detail;
          if (selection === 0) {
            this.fileInputExperience(options, resolve, reject);
          } else {
            this.cameraExperience(options, resolve, reject);
          }
        });
      } else {
        this.cameraExperience(options, resolve, reject);
      }
    });
  }
  async pickImages(_options) {
    return new Promise(async (resolve, reject) => {
      this.multipleFileInputExperience(resolve, reject);
    });
  }
  async cameraExperience(options, resolve, reject) {
    if (customElements.get("pwa-camera-modal")) {
      const cameraModal = document.createElement("pwa-camera-modal");
      cameraModal.facingMode = options.direction === CameraDirection.Front ? "user" : "environment";
      document.body.appendChild(cameraModal);
      try {
        await cameraModal.componentOnReady();
        cameraModal.addEventListener("onPhoto", async (e) => {
          const photo = e.detail;
          if (photo === null) {
            reject(new CapacitorException("User cancelled photos app"));
          } else if (photo instanceof Error) {
            reject(photo);
          } else {
            resolve(await this._getCameraPhoto(photo, options));
          }
          cameraModal.dismiss();
          document.body.removeChild(cameraModal);
        });
        cameraModal.present();
      } catch (e) {
        this.fileInputExperience(options, resolve, reject);
      }
    } else {
      console.error(`Unable to load PWA Element 'pwa-camera-modal'. See the docs: https://capacitorjs.com/docs/web/pwa-elements.`);
      this.fileInputExperience(options, resolve, reject);
    }
  }
  fileInputExperience(options, resolve, reject) {
    let input = document.querySelector("#_capacitor-camera-input");
    const cleanup = () => {
      var _a;
      (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);
    };
    if (!input) {
      input = document.createElement("input");
      input.id = "_capacitor-camera-input";
      input.type = "file";
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener("change", (_e) => {
        const file = input.files[0];
        let format = "jpeg";
        if (file.type === "image/png") {
          format = "png";
        } else if (file.type === "image/gif") {
          format = "gif";
        }
        if (options.resultType === "dataUrl" || options.resultType === "base64") {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (options.resultType === "dataUrl") {
              resolve({
                dataUrl: reader.result,
                format
              });
            } else if (options.resultType === "base64") {
              const b64 = reader.result.split(",")[1];
              resolve({
                base64String: b64,
                format
              });
            }
            cleanup();
          });
          reader.readAsDataURL(file);
        } else {
          resolve({
            webPath: URL.createObjectURL(file),
            format
          });
          cleanup();
        }
      });
      input.addEventListener("cancel", (_e) => {
        reject(new CapacitorException("User cancelled photos app"));
        cleanup();
      });
    }
    input.accept = "image/*";
    input.capture = true;
    if (options.source === CameraSource.Photos || options.source === CameraSource.Prompt) {
      input.removeAttribute("capture");
    } else if (options.direction === CameraDirection.Front) {
      input.capture = "user";
    } else if (options.direction === CameraDirection.Rear) {
      input.capture = "environment";
    }
    input.click();
  }
  multipleFileInputExperience(resolve, reject) {
    let input = document.querySelector("#_capacitor-camera-input-multiple");
    const cleanup = () => {
      var _a;
      (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);
    };
    if (!input) {
      input = document.createElement("input");
      input.id = "_capacitor-camera-input-multiple";
      input.type = "file";
      input.hidden = true;
      input.multiple = true;
      document.body.appendChild(input);
      input.addEventListener("change", (_e) => {
        const photos = [];
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          let format = "jpeg";
          if (file.type === "image/png") {
            format = "png";
          } else if (file.type === "image/gif") {
            format = "gif";
          }
          photos.push({
            webPath: URL.createObjectURL(file),
            format
          });
        }
        resolve({ photos });
        cleanup();
      });
      input.addEventListener("cancel", (_e) => {
        reject(new CapacitorException("User cancelled photos app"));
        cleanup();
      });
    }
    input.accept = "image/*";
    input.click();
  }
  _getCameraPhoto(photo, options) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const format = photo.type.split("/")[1];
      if (options.resultType === "uri") {
        resolve({
          webPath: URL.createObjectURL(photo),
          format,
          saved: false
        });
      } else {
        reader.readAsDataURL(photo);
        reader.onloadend = () => {
          const r = reader.result;
          if (options.resultType === "dataUrl") {
            resolve({
              dataUrl: r,
              format,
              saved: false
            });
          } else {
            resolve({
              base64String: r.split(",")[1],
              format,
              saved: false
            });
          }
        };
        reader.onerror = (e) => {
          reject(e);
        };
      }
    });
  }
  async checkPermissions() {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      throw this.unavailable("Permissions API not available in this browser");
    }
    try {
      const permission = await window.navigator.permissions.query({
        name: "camera"
      });
      return {
        camera: permission.state,
        photos: "granted"
      };
    } catch (_a) {
      throw this.unavailable("Camera permissions are not available in this browser");
    }
  }
  async requestPermissions() {
    throw this.unimplemented("Not implemented on web.");
  }
  async pickLimitedLibraryPhotos() {
    throw this.unavailable("Not implemented on web.");
  }
  async getLimitedLibraryPhotos() {
    throw this.unavailable("Not implemented on web.");
  }
};
var Camera = new CameraWeb();

// node_modules/@capacitor/camera/dist/esm/index.js
var Camera2 = registerPlugin("Camera", {
  web: () => new CameraWeb()
});

// node_modules/@ionic/pwa-elements/dist/esm-es5/loader.js
init_index_1c5c47b4();
init_index_1c5c47b4();
var patchEsm = function() {
  return promiseResolve();
};
var defineCustomElements = function(e, o) {
  if (typeof window === "undefined") return Promise.resolve();
  return patchEsm().then((function() {
    return bootstrapLazy([["pwa-camera-modal", [[1, "pwa-camera-modal", { facingMode: [1, "facing-mode"], hidePicker: [4, "hide-picker"], present: [64], dismiss: [64] }]]], ["pwa-action-sheet", [[1, "pwa-action-sheet", { header: [1], cancelable: [4], options: [16], open: [32] }]]], ["pwa-toast", [[1, "pwa-toast", { message: [1], duration: [2], closing: [32] }]]], ["pwa-camera", [[1, "pwa-camera", { facingMode: [1, "facing-mode"], handlePhoto: [16], hidePicker: [4, "hide-picker"], handleNoDeviceError: [16], noDevicesText: [1, "no-devices-text"], noDevicesButtonText: [1, "no-devices-button-text"], photo: [32], photoSrc: [32], showShutterOverlay: [32], flashIndex: [32], hasCamera: [32], rotation: [32], deviceError: [32] }]]], ["pwa-camera-modal-instance", [[1, "pwa-camera-modal-instance", { facingMode: [1, "facing-mode"], hidePicker: [4, "hide-picker"], noDevicesText: [1, "no-devices-text"], noDevicesButtonText: [1, "no-devices-button-text"] }, [[16, "keyup", "handleBackdropKeyUp"]]]]]], o);
  }));
};

// node_modules/@ionic/pwa-elements/loader/index.js
(function() {
  if ("undefined" !== typeof window && void 0 !== window.Reflect && void 0 !== window.customElements) {
    var a = HTMLElement;
    window.HTMLElement = function() {
      return Reflect.construct(a, [], this.constructor);
    };
    HTMLElement.prototype = a.prototype;
    HTMLElement.prototype.constructor = HTMLElement;
    Object.setPrototypeOf(HTMLElement, a);
  }
})();

// www/js/camera-bridge.js
if (typeof window !== "undefined") {
  defineCustomElements(window);
}

// Exports removed for regular script loading
// export {
//   Camera2 as Camera,
//   CameraResultType,
//   CameraSource
// };
/*! Bundled license information:

@ionic/pwa-elements/dist/esm-es5/pwa-camera.entry.js:
  (**
   * MediaStream ImageCapture polyfill
   *
   * @license
   * Copyright 2018 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *      http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *)

@capacitor/core/dist/index.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)
*/
