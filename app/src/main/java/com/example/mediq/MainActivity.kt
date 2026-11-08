package com.example.mediq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.mediq.ui.components.MediQBottomBar
import com.example.mediq.ui.components.mainTabForRoute
import com.example.mediq.data.api.SupabaseClient
import com.example.mediq.ui.navigation.MediQNavHost
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.session.MediQSession
import com.example.mediq.ui.theme.MediQTheme

class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Restore the signed-in account (if any) before drawing the first
        // screen, so closing and reopening the app keeps the session.
        MediQSession.init(applicationContext)
        SupabaseClient.accessToken = MediQSession.accessToken
        android.widget.Toast.makeText(
            this,
            if (MediQSession.user.value != null) "Restored: ${MediQSession.user.value?.username}" else "No session restored",
            android.widget.Toast.LENGTH_LONG
        ).show()

        val startDestination = if (MediQSession.user.value != null) {
            Screen.BiometricUnlock.route
        } else {
            Screen.SignIn.route
        }

        // Every screen here has light chrome behind the system bars, so the
        // default auto-detected system bar style is correct. MediQTheme sets the
        // icon appearance to match.
        enableEdgeToEdge()

        setContent {
            MediQTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                // Shown on every main tab except the chat detail route
                // (message_chat/...), where the bottom bar is removed so the
                // conversation fills the screen edge-to-edge. The Messages list
                // itself keeps the bar since it's a main tab.
                val showBottomBar = mainTabForRoute(currentRoute) != null &&
                    currentRoute?.startsWith("message_chat/") != true

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        if (showBottomBar) {
                            MediQBottomBar(navController = navController)
                        }
                    }
                ) { innerPadding ->
                    Box(modifier = Modifier.padding(innerPadding)) {
                        MediQNavHost(navController = navController, startDestination = startDestination)
                    }
                }
            }
        }
    }
}
