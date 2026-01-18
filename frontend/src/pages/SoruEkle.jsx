import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function SoruEkle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Yeni Soru Ekle</h1>
        <button
          onClick={() => navigate('/sorular')}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-medium"
        >
          İptal / Geri
        </button>
      </div>

      <div className="bg-white p-12 border-2 border-dashed border-gray-300 rounded-xl text-center">
        <div className="text-6xl mb-4">✨</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Sayfa Sıfırlandı</h2>
        <p className="text-gray-500">
          Soru ekleme ekranını isteğiniz üzerine tamamen temizledim.
          <br />
          Şimdi sıfırdan, adım adım tasarlamaya hazırız.
        </p>
      </div>
    </div>
  );
}
