'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RestaurantType } from '@/types';
import {
  Navigation,
  Building2,
  Layers,
  RotateCcw,
} from 'lucide-react';
import type { Map as LeafletMap, Marker } from 'leaflet';

interface CafeteriaMapProps {
  selectedRestaurant: RestaurantType;
  onSelectRestaurant: (restaurant: RestaurantType) => void;
}

// 실제 동서대학교 주례캠퍼스 식당 좌표 및 시설 정보 (OpenStreetMap 실제 건물 좌표 기준)
export interface BuildingInfo {
  id: RestaurantType;
  name: string;
  buildingName: string;
  floor: string;
  lat: number;
  lng: number;
}

export const DSU_RESTAURANTS: BuildingInfo[] = [
  {
    id: '글빌 식당',
    name: '글로벌빌리지 식당',
    buildingName: '글로벌빌리지 (23번 건물)',
    floor: '지상 4층',
    lat: 35.14655,
    lng: 129.00760,
  },
  {
    id: '스플 식당',
    name: '스튜던트플라자 식당',
    buildingName: '스튜던트플라자 (24번 건물)',
    floor: '지상 2층',
    lat: 35.145665,
    lng: 129.009589,
  },
  {
    id: '경영 식당',
    name: '경영관 식당',
    buildingName: '경영관 (8번 건물)',
    floor: '지상 1층',
    lat: 35.143564,
    lng: 129.010401,
  },
];

// 캠퍼스 주요 랜드마크 건물 (OpenStreetMap 실제 건물 중심 좌표)
const DSU_LANDMARKS = [
  { name: '민석도서관', lat: 35.144126, lng: 129.012541, desc: '중앙도서관' },
  { name: '뉴밀레니엄관', lat: 35.145228, lng: 129.007722, desc: 'IT/미디어관' },
  { name: '민석 스포츠센터', lat: 35.145182, lng: 129.011560, desc: '체육시설' },
  { name: '대학교회', lat: 35.145489, lng: 129.010856, desc: '대학교회' },
];

// 동서대학교 전체 캠퍼스 중심 좌표 및 기본 줌
const CAMPUS_CENTER: [number, number] = [35.1450, 129.0095];
const DEFAULT_ZOOM = 16;

export default function CafeteriaMap({
  selectedRestaurant,
  onSelectRestaurant,
}: CafeteriaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: string]: Marker }>({});
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isLoaded, setIsLoaded] = useState(false);

  const currentBuilding =
    DSU_RESTAURANTS.find((r) => r.id === selectedRestaurant) || DSU_RESTAURANTS[0];

  // Leaflet 지도 초기화
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // 이미 초기화된 경우 스킵

      const L = await import('leaflet');
      if (isCancelled || !mapContainerRef.current) return;

      // 지도 인스턴스 생성
      const map = L.map(mapContainerRef.current, {
        center: CAMPUS_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 15,
        maxZoom: 19,
        zoomControl: false, // 커스텀 줌 위치 위해 기본 숨김
      });

      // 줌 컨트롤 우측 상단 추가
      L.control.zoom({ position: 'topright' }).addTo(map);

      // 타일 레이어 추가 (일반: 오픈스트리트맵 공식 타일 / 위성: 초고해상도 Esri 항공 위성 타일)
      const tileUrl =
        mapType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // 랜드마크 건물 보조 마커 추가
      DSU_LANDMARKS.forEach((lm) => {
        const landmarkIcon = L.divIcon({
          className: 'dsu-landmark-marker',
          html: `
            <div style="transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(4px); border: 1px solid #cbd5e1; border-radius: 6px; font-size: 9px; font-weight: 600; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.06); white-space: nowrap; pointer-events: none;">
              <span style="width: 5px; height: 5px; border-radius: 50%; background: #94a3b8;"></span>
              <span>${lm.name}</span>
            </div>
          `,
          iconSize: [0, 0],
        });
        L.marker([lm.lat, lm.lng], { icon: landmarkIcon, interactive: false }).addTo(map);
      });

      // 식당 마커 생성 함수
      const createMarkers = () => {
        DSU_RESTAURANTS.forEach((rest) => {
          const isSelected = rest.id === selectedRestaurant;

          const markerHtml = `
            <div style="transform: translate(-50%, -100%); cursor: pointer; display: flex; flex-direction: column; align-items: center;">
              <div style="
                position: relative;
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 5px 10px;
                background: ${isSelected ? '#9e1b32' : '#ffffff'};
                color: ${isSelected ? '#ffffff' : '#1e293b'};
                border: 2px solid ${isSelected ? '#ffffff' : '#9e1b32'};
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 800;
                box-shadow: 0 4px 10px rgba(0,0,0,0.22);
                white-space: nowrap;
                transition: all 0.2s ease;
              ">
                ${isSelected ? '<span style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(158, 27, 50, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>' : ''}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#ffffff' : '#9e1b32'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>${rest.name}</span>
                <span style="
                  font-size: 9px;
                  font-weight: 600;
                  padding: 1px 5px;
                  border-radius: 9999px;
                  background: ${isSelected ? 'rgba(0,0,0,0.25)' : '#f1f5f9'};
                  color: ${isSelected ? '#ffffff' : '#64748b'};
                ">${rest.floor}</span>
              </div>
              <div style="
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-top: 7px solid ${isSelected ? '#9e1b32' : '#ffffff'};
                margin-top: -1px;
                filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));
              "></div>
            </div>
          `;

          const customIcon = L.divIcon({
            className: `dsu-cafeteria-marker-${rest.id}`,
            html: markerHtml,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          const marker = L.marker([rest.lat, rest.lng], { icon: customIcon }).addTo(map);

          marker.on('click', () => {
            onSelectRestaurant(rest.id);
          });

          markersRef.current[rest.id] = marker;
        });
      };

      createMarkers();
      mapInstanceRef.current = map;
      setIsLoaded(true);
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 타일 레이어 전환 (일반 / 위성)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((L) => {
      // 기존 레이어 제거 후 새 타일 장착
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer);
        }
      });

      const url =
        mapType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(url, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
    });
  }, [mapType]);

  // 선택된 식당이 변경되었을 때: 마커 스타일 업데이트 & 부드러운 카메라 이동
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((L) => {
      // 각 식당 마커 아이콘 새로고침
      DSU_RESTAURANTS.forEach((rest) => {
        const marker = markersRef.current[rest.id];
        if (!marker) return;

        const isSelected = rest.id === selectedRestaurant;
        const markerHtml = `
          <div style="transform: translate(-50%, -100%); cursor: pointer; display: flex; flex-direction: column; align-items: center;">
            <div style="
              position: relative;
              display: flex;
              align-items: center;
              gap: 5px;
              padding: 5px 10px;
              background: ${isSelected ? '#9e1b32' : '#ffffff'};
              color: ${isSelected ? '#ffffff' : '#1e293b'};
              border: 2px solid ${isSelected ? '#ffffff' : '#9e1b32'};
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 800;
              box-shadow: 0 4px 10px rgba(0,0,0,0.22);
              white-space: nowrap;
              transition: all 0.2s ease;
            ">
              ${isSelected ? '<span style="position: absolute; inset: -4px; border-radius: 9999px; background: rgba(158, 27, 50, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>' : ''}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#ffffff' : '#9e1b32'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>${rest.name}</span>
              <span style="
                font-size: 9px;
                font-weight: 600;
                padding: 1px 5px;
                border-radius: 9999px;
                background: ${isSelected ? 'rgba(0,0,0,0.25)' : '#f1f5f9'};
                color: ${isSelected ? '#ffffff' : '#64748b'};
              ">${rest.floor}</span>
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid ${isSelected ? '#9e1b32' : '#ffffff'};
              margin-top: -1px;
              filter: drop-shadow(0 2px 2px rgba(0,0,0,0.15));
            "></div>
          </div>
        `;

        marker.setIcon(
          L.divIcon({
            className: `dsu-cafeteria-marker-${rest.id}`,
            html: markerHtml,
            iconSize: [0, 0],
          })
        );
      });

      // 선택된 식당 위치로 부드럽게 카메라 이동 (flyTo)
      const target = DSU_RESTAURANTS.find((r) => r.id === selectedRestaurant);
      if (target) {
        map.flyTo([target.lat, target.lng], 17, {
          duration: 0.8,
          easeLinearity: 0.25,
        });
      }
    });
  }, [selectedRestaurant, isLoaded]);

  // 캠퍼스 전체 뷰 리셋
  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(CAMPUS_CENTER, DEFAULT_ZOOM, { duration: 0.6 });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      {/* ===================== 상단 지도 컨트롤 바 ===================== */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Navigation className="w-3.5 h-3.5 text-dongseo-700" />
          <span>동서대 실제 캠퍼스 지도</span>
          <span className="text-[10px] text-slate-500 font-normal">
            (실제 GPS 좌표 기반)
          </span>
        </div>

        {/* 맵 타입 토글 & 리셋 버튼 */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition border ${
              mapType === 'satellite'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>{mapType === 'satellite' ? '위성 지도' : '일반 지도'}</span>
          </button>

          <button
            onClick={handleResetView}
            title="동서대 전체보기"
            className="p-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===================== 실제 Leaflet 지도 컨테이너 ===================== */}
      <div className="relative w-full h-64 bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* 지도 우측 하단 동서대학교 주례캠퍼스 워터마크 태그 */}
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-dongseo-700 shadow-xs flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-dongseo-700" />
          <span>부산 사상구 주례로 47 동서대</span>
        </div>
      </div>

      {/* ===================== 선택된 식당/건물 상세 안내 바 ===================== */}
      <div className="p-3.5 bg-white flex flex-col gap-2 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-dongseo-50 text-dongseo-700 border border-dongseo-200">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm">
                  {currentBuilding.name}
                </span>
                <span className="text-[10px] text-dongseo-700 bg-dongseo-50 px-1.5 py-0.2 rounded font-semibold border border-dongseo-200">
                  {currentBuilding.floor}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {currentBuilding.buildingName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
