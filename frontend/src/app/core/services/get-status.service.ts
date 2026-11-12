import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; // Ajusta la ruta de tu environment si es necesario

@Injectable({
  providedIn: 'root'
})
export class GetStatusService {
  // Asegúrate de que tu environment.ts tenga la URL base de tu API HTTP Gateway (sin el /imports al final)
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Consulta los lotes/importaciones del usuario autenticado vía JWT
  getUserImports(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/imports`);
  }

  // Descargar JSON de errores para corrección
  downloadErrorJson(batchId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/imports/${batchId}/export?type=json`, {
      responseType: 'blob'
    });
  }

  // Obtener URL presignada del PDF
  getReportPdfUrl(batchId: string): Observable<{ downloadUrl: string }> {
    return this.http.get<{ downloadUrl: string }>(`${this.apiUrl}/imports/${batchId}/export?type=pdf`);
  }
}
