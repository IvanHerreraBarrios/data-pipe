import { Injectable } from '@angular/core';
import * as SparkMD5 from 'spark-md5';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Función para calcular el MD5 (ETag) localmente en el navegador
  public calculateFileHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunkSize = 2097152; // 2MB por chunk para no congelar el navegador
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();

      fileReader.onload = (e: any) => {
        spark.append(e.target.result); // Acumulamos el fragmento
        currentChunk++;

        if (currentChunk < chunks) {
          loadNext();
        } else {
          const hash = spark.end();
          resolve(hash); // ¡Aquí tenemos el hash exacto que generará S3!
        }
      };

      fileReader.onerror = () => {
        reject('Error leyendo el archivo para calcular el hash.');
      };

      const loadNext = () => {
        const start = currentChunk * chunkSize;
        const end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
        fileReader.readAsArrayBuffer(file.slice(start, end));
      };

      loadNext();
    });
  }

  // Llamada a nuestra nueva Lambda Validator en API Gateway
  public validateDuplicate(fileHash: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/validate`, {
      fileHash: fileHash,
      userId: userId
    });
  }

  // Petición de la URL firmada para la subida a S3 enviando también el batchId
  public getUploadUrl(fileName: string, batchId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/get-upload-url`, {
      fileName: fileName,
      batchId: batchId
    });
  }


}
