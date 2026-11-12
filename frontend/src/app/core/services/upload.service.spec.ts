import { TestBed } from '@angular/core/testing';
import { UploadService } from './upload.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UploadService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(UploadService);
  });

  it('debería crearse correctamente', () => {
    expect(service).toBeTruthy();
  });



  it('debería calcular el hash de un archivo correctamente', async () => {
    // Creamos un archivo simulado (Blob/File) de prueba
    const dummyFile = new File(['contenido de prueba para el hash'], 'test.json', { type: 'application/json' });

    const hash = await service.calculateFileHash(dummyFile);

    // Verificamos que retorne un hash en cadena de texto (ej. SHA-256 en hexadecimal)
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
