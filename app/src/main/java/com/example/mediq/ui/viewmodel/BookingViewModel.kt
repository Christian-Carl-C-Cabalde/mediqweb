package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class BookingViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _doctors = MutableStateFlow<List<Doctor>>(emptyList())
    val doctors: StateFlow<List<Doctor>> = _doctors.asStateFlow()

    private val _specializations = MutableStateFlow<List<Specialty>>(emptyList())
    val specializations: StateFlow<List<Specialty>> = _specializations.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _bookingResult = MutableStateFlow<Appointment?>(null)
    val bookingResult: StateFlow<Appointment?> = _bookingResult.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun loadDoctors(specializationId: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val result = api.getDoctors(specializationId = specializationId)
                _doctors.value = result.items
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load doctors"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun loadSpecializations() {
        viewModelScope.launch {
            try {
                _specializations.value = api.getSpecializations()
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load specializations"
            }
        }
    }

    fun bookAppointment(request: BookingRequest) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val appointment = api.createAppointment(request)
                _bookingResult.value = appointment
            } catch (e: Exception) {
                _error.value = e.message ?: "Booking failed"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearBookingResult() {
        _bookingResult.value = null
    }
}