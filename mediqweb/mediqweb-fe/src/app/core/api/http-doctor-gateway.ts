import { Injectable, inject } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Doctor, Paged } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class HttpDoctorGateway {
  private supabase = inject(SupabaseService);

  getDoctors(params?: {
    specializationId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Observable<Paged<Doctor>> {
    let q = (this.supabase as any).from('doctors').select('*', { count: 'exact' });
    if (params?.specializationId) {
      q = q.eq('specialization_id', params.specializationId);
    }
    if (params?.search) {
      q = q.ilike('full_name', `%${params.search}%`);
    }
    if (params?.limit) {
      q = q.limit(params.limit);
    }
    if (params?.offset) {
      q = q.range(params.offset, params.offset + (params.limit ?? 20) - 1);
    } else if (params?.limit) {
      q = q.range(0, params.limit - 1);
    }
    return from(q).pipe(
      map((r: any) => {
        const items: Doctor[] = (r.data ?? []).map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          fullName: d.full_name,
          specialty: d.specialty,
          specializationId: d.specialization_id,
          licenseNumber: d.license_number,
          yearsOfExperience: d.years_of_experience,
          feeCentavos: d.fee_centavos,
          bio: d.bio,
          building: d.building,
          floor: d.floor,
          room: d.room,
          languages: d.languages,
          status: d.status,
        }));
        return {
          items,
          total: r.count ?? items.length,
          limit: params?.limit ?? items.length,
          offset: params?.offset ?? 0,
        };
      }),
    );
  }

  getDoctor(id: string): Observable<Doctor> {
    return from((this.supabase as any).from('doctors').select('*').eq('id', id).single()).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Doctor not found');
        }
        const d = r.data;
        return {
          id: d.id,
          userId: d.user_id,
          fullName: d.full_name,
          specialty: d.specialty,
          specializationId: d.specialization_id,
          licenseNumber: d.license_number,
          yearsOfExperience: d.years_of_experience,
          feeCentavos: d.fee_centavos,
          bio: d.bio,
          building: d.building,
          floor: d.floor,
          room: d.room,
          languages: d.languages,
          status: d.status,
        };
      }),
    );
  }
}
