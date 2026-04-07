import api from '../api/axios';
import { HRDocument } from '../types/document';

export const getDocuments = async (): Promise<HRDocument[]> => {
  const response = await api.get('/api/hr-documents/');
  return response.data.results ?? response.data;
};

export const uploadDocument = async (formData: FormData): Promise<HRDocument> => {
  const response = await api.post('/api/hr-documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const updateDocument = async (id: number, formData: FormData): Promise<HRDocument> => {
  const response = await api.patch(`/api/hr-documents/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteDocument = async (id: number): Promise<void> => {
  await api.delete(`/api/hr-documents/${id}/`);
};

export const downloadDocument = (id: number): void => {
  const token = localStorage.getItem('access_token');
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const url = `${baseUrl}/api/hr-documents/${id}/download/`;
  
  fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    });
};
