#include "cef/CefApplication.hpp"

#include "include/cef_frame.h"
#include "include/cef_process_message.h"
#include "include/cef_v8.h"

namespace {
constexpr char kNativeMessageName[] = "tpn.native.message";

class NativePostMessageHandler final : public CefV8Handler {
public:
    bool Execute(const CefString&, CefRefPtr<CefV8Value>, const CefV8ValueList& arguments,
                 CefRefPtr<CefV8Value>& retval, CefString& exception) override {
        if (arguments.size() != 1 || !arguments[0]->IsString()) {
            exception = "postMessage expects one JSON string";
            return true;
        }

        const auto context = CefV8Context::GetCurrentContext();
        if (!context || !context->GetFrame()) {
            exception = "postMessage has no active frame";
            return true;
        }

        auto message = CefProcessMessage::Create(kNativeMessageName);
        message->GetArgumentList()->SetString(0, arguments[0]->GetStringValue());
        context->GetFrame()->SendProcessMessage(PID_BROWSER, message);
        retval = CefV8Value::CreateUndefined();
        return true;
    }

private:
    IMPLEMENT_REFCOUNTING(NativePostMessageHandler);
};

class HudCefApplication final : public CefApp, public CefRenderProcessHandler {
public:
    CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override { return this; }

    void OnContextCreated(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame,
                          CefRefPtr<CefV8Context> context) override {
        context->GetGlobal()->SetValue(
            "__tpnNativePostMessage",
            CefV8Value::CreateFunction("__tpnNativePostMessage", new NativePostMessageHandler),
            V8_PROPERTY_ATTRIBUTE_DONTDELETE);

        frame->ExecuteJavaScript(
            R"js((()=>{
                const bridge = new EventTarget();
                bridge.postMessage = message => __tpnNativePostMessage(JSON.stringify(message));
                window.chrome = window.chrome || {};
                window.chrome.webview = bridge;
                window.addEventListener('error', event => bridge.postMessage({
                    type:'app.frontendError', message:String(event.message),
                    source:String(event.filename), line:event.lineno
                }));
                window.addEventListener('unhandledrejection', event => bridge.postMessage({
                    type:'app.frontendError', message:String(event.reason)
                }));
            })())js",
            frame->GetURL(), 0);
    }

private:
    IMPLEMENT_REFCOUNTING(HudCefApplication);
};
}

CefRefPtr<CefApp> CreateHudCefApplication() {
    return new HudCefApplication;
}
