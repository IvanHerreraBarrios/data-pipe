import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { GetStatusService } from '../../core/services/get-status.service';
import { UploadService } from '../../core/services/upload.service'; // <--- Importamos tu servicio

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  standalone: true,
  imports: [CommonModule],
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  selectedFile: File | null = null;
  uploadStatus: string = '';

  public batches: any[] = [];
  private pollingSub!: Subscription;
  private userId: string = '';

  constructor(
    private router: Router,
    private getStatusService: GetStatusService,
    private uploadService: UploadService // <--- Inyectamos el UploadService
  ) {}

  ngOnInit(): void {
    this.userId = this.getUserIdFromCookie();
    console.log('[Dashboard] prueba frontend v5 userId extraído de la cookie:', this.userId);

    if (this.userId) {
      this.fetchBatches();

      // Polling inteligente cada 3 segundos
      this.pollingSub = interval(3000).pipe(
        switchMap(() => this.getStatusService.getUserImports())
      ).subscribe({
        next: (data: any[]) => {
          this.batches = data || [];
        },
        error: (err) => {
          console.error('[Dashboard] Error en el polling de lotes:', err);
        }
      });
    } else {
      console.warn('[Dashboard] No se encontró la cookie con el token de usuario.');
    }
  }

  fetchBatches(): void {
    this.getStatusService.getUserImports().subscribe({
      next: (data: any[]) => {
        this.batches = data || [];
      },
      error: (err) => {
        console.error('[Dashboard] Error al obtener lotes:', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  private getUserIdFromCookie(): string {
    try {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith('datapipe_token')) {
          const cookieValue = cookie.split('=')[1];
          if (!cookieValue) continue;

          const jwtPart = cookieValue.split('.cloudfront.net')[0];
          const parts = jwtPart.split('.');

          if (parts.length >= 2) {
            const decodedPayload = JSON.parse(atob(parts[1]));
            if (decodedPayload && decodedPayload.sub) {
              return decodedPayload.sub;
            }
          }
        }
      }
    } catch (e) {
      console.error('[Dashboard] Error al decodificar la cookie:', e);
    }
    return 'f2c504a4-7081-7017-0d39-a59b9139cc0c';
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    this.uploadStatus = '';
  }

  // --- FLUJO UNIFICADO DE VALIDACIÓN Y SUBIDA ---
  async uploadFile() {
    if (!this.selectedFile) return;

    try {
      this.uploadStatus = 'Calculando huella digital del archivo...';

      //  Calculamos el hash localmente usando el servicio
      const fileHash = await this.uploadService.calculateFileHash(this.selectedFile);

      this.uploadStatus = 'Verificando duplicados en el servidor...';

      //  Validamos el duplicado con la Lambda a través del servicio
      this.uploadService.validateDuplicate(fileHash, this.userId).subscribe({
        next: () => {
          // Si pasa (Status 200 - Archivo único), procedemos a pedir la URL y subir
          this.requestPresignedUrlAndUpload();
        },
        error: (err) => {
          // Si la Lambda responde 400 porque ya existe
          if (err.status === 400 && err.error?.exists) {
            this.uploadStatus = '⚠️ Este archivo ya fue subido anteriormente.';
          } else {
            this.uploadStatus = 'Error al validar el archivo con el servidor.';
          }
        }
      });

    } catch (error) {
      console.error('Error en el proceso de hash:', error);
      this.uploadStatus = 'Error procesando el archivo localmente.';
    }
  }

  // Pide la URL firmada y sube el archivo a S3 vía PUT
  // Pide la URL firmada y sube el archivo a S3 vía PUT
  private async requestPresignedUrlAndUpload() {
    this.uploadStatus = 'Analizando contenido del archivo...';

    try {
      //  Leemos el contenido del archivo JSON para extraer su batchId
      const fileContent = await this.selectedFile!.text();
      const jsonData = JSON.parse(fileContent);
      const batchId = jsonData.batchId;

      if (!batchId) {
        this.uploadStatus = '⚠️ El archivo JSON no contiene un campo "batchId" válido.';
        return;
      }

      this.uploadStatus = 'Solicitando autorización y validando lote...';

      //  Solicitamos la URL firmada enviando el fileName y el batchId
      this.uploadService.getUploadUrl(this.selectedFile!.name, batchId).subscribe({
        next: async (response) => {
          const presignedUrl = response.uploadUrl;
          this.uploadStatus = 'Subiendo archivo a S3...';

          try {
            const uploadResponse = await fetch(presignedUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: this.selectedFile
            });

            if (uploadResponse.ok) {
              this.uploadStatus = '¡Archivo guardado con éxito en tu carpeta en S3!';
              this.selectedFile = null;
              setTimeout(() => this.fetchBatches(), 1000);
            } else {
              this.uploadStatus = 'Error al transferir el archivo al bucket.';
            }
          } catch (err) {
            this.uploadStatus = 'Error de red al transferir el archivo.';
          }
        },
        error: (err) => {
          // Si el servidor responde con 409 Conflict porque el batchId ya está registrado
          if (err.status === 409) {
            this.uploadStatus = `⚠️ ${err.error?.error || 'El batchId ya fue registrado anteriormente.'}`;
          } else {
            this.uploadStatus = 'Acceso denegado o error en el servidor al validar el lote.';
          }
        }
      });

    } catch (e) {
      this.uploadStatus = 'Error: El archivo seleccionado no es un JSON válido.';
    }
  }


  logout() {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'datapipe_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/auth';
  }

  downloadJsonCorrection(batchId: string) {
    this.getStatusService.downloadErrorJson(batchId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `correccion-${batchId}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error al descargar JSON de errores:', err)
    });
  }

  downloadPdfReport(batchId: string) {
    this.getStatusService.getReportPdfUrl(batchId).subscribe({
      next: (response) => {
        if (response.downloadUrl) {
          window.open(response.downloadUrl, '_blank');
        }
      },
      error: (err) => console.error('Error al obtener reporte PDF:', err)
    });
  }
}
