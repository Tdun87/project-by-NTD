package com.antiscam.guard

import android.telecom.Call
import android.telecom.CallScreeningService
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.plugin.common.MethodChannel

/**
 * Cầu nối Native Android: Bắt sự kiện cuộc gọi hệ thống và đẩy sang Flutter Engine
 */
class NativeCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        val incomingNumber = callDetails.handle?.schemeSpecificPart ?: ""

        // Gửi số điện thoại sang Flutter Engine thông qua MethodChannel để xử lý Tầng 0
        FlutterEngineCache.getInstance().get("antiscam_engine")?.let { engine ->
            MethodChannel(engine.dartExecutor.binaryMessenger, "com.antiscam.guard/tier0")
                .invokeMethod("onIncomingCall", mapOf("number" to incomingNumber))
        }

        // Trả quyền điều khiển cuộc gọi ngay lập tức cho hệ điều hành (< 50ms)
        respondToCall(callDetails, CallResponse.Builder().build())
    }
}