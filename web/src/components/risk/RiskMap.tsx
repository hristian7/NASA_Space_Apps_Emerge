'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Map as MapInstance, Marker } from 'maplibre-gl';
import { basemaps } from '@/config/basemaps';
import { tokenColor } from '@/lib/ui/token-color';
import { regionAt } from '@/lib/risk/geo';
import type { RiskRegion, RiskSpot } from '@/types/risk';

/** Scoped adapter: shared MapView has no risk overlay or map-instance interface. */
export default function RiskMap({regions,region,spots,onRegion,onSpot}: {
 regions:RiskRegion[]; region:RiskRegion; spots:RiskSpot[];
 onRegion:(id:string)=>void; onSpot:(id:number)=>void;
}) {
 const t=useTranslations('risk'); const locale=useLocale();
 const container=useRef<HTMLDivElement>(null); const map=useRef<MapInstance|null>(null);
 const callbacks=useRef({regions,onRegion}); callbacks.current={regions,onRegion};
 const currentRegion=useRef(region);currentRegion.current=region;
 const [ready,setReady]=useState(false); const [failed,setFailed]=useState(false);
 const [tilesUnavailable,setTilesUnavailable]=useState(false);
 useEffect(()=>{
  let cancelled=false;let observer:ResizeObserver|undefined;
  import('maplibre-gl').then(lib=>{
   if(cancelled||!container.current)return;
   lib.setWorkerUrl('/vendor/maplibre-worker');
   const base=basemaps[0];
   const instance=new lib.Map({container:container.current,attributionControl:false,
    style:base.style??{version:8,sources:{base:{type:'raster',tiles:base.tiles,tileSize:base.tileSize,attribution:base.attribution,maxzoom:base.maxzoom}},layers:[{id:'background',type:'background',paint:{'background-color':tokenColor('--space')}},{id:'base',type:'raster',source:'base'}]},
    center:[23.5,42.2],zoom:7,dragRotate:false,maxPitch:0});
   map.current=instance;
   observer=new ResizeObserver(()=>{
    instance.resize();
    const [w,s,e,n]=currentRegion.current.bbox;
    instance.fitBounds([[w,s],[e,n]],{padding:52,duration:0,maxZoom:10});
   });
   observer.observe(container.current);
   instance.addControl(new lib.AttributionControl({compact:true}),'bottom-right');
   instance.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
   instance.on('load',()=>{instance.getCanvas().setAttribute('aria-label',t('map'));setReady(true);});
   instance.on('error',()=>setTilesUnavailable(true));
   instance.on('click',e=>{const hit=regionAt(callbacks.current.regions,e.lngLat.lat,e.lngLat.lng);if(hit)callbacks.current.onRegion(hit.region_id);});
  }).catch(()=>{if(!cancelled)setFailed(true);});
  return ()=>{cancelled=true;observer?.disconnect();map.current?.remove();map.current=null;};
  // Map lifetime is independent of region, day and locale updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  if(!map.current||!ready)return;
  map.current.fitBounds([[region.bbox[0],region.bbox[1]],[region.bbox[2],region.bbox[3]]],{padding:52,duration:0,maxZoom:10});
 },[region,ready]);
 useEffect(()=>{
  if(!map.current||!ready)return;
  let cancelled=false; const markers:Marker[]=[];
  import('maplibre-gl').then(lib=>{
   if(cancelled||!map.current)return;
   for(const r of regions.filter(r=>r.country===region.country&&r.region_id!==region.region_id)) {
    const el=document.createElement('button'); el.className='risk-region-pin';
    el.textContent=locale==='bg'?r.name_local:r.name_en;
    el.setAttribute('aria-label',t('chooseRegion',{name:el.textContent}));
    el.addEventListener('click',e=>{e.stopPropagation();onRegion(r.region_id);});
    markers.push(new lib.Marker({element:el}).setLngLat([(r.bbox[0]+r.bbox[2])/2,(r.bbox[1]+r.bbox[3])/2]).addTo(map.current));
   }
   for(const spot of spots) {
    const el=document.createElement('button');el.className='risk-pin';el.dataset.level=String(spot.level);
    el.dataset.missing=String(spot.p===null);el.textContent=String(spot.rank);
    el.style.setProperty('--spot-size',`${24+spot.level*4}px`);
    el.setAttribute('aria-label',spot.p===null?t('mapSpotMissing',{rank:spot.rank}):t('mapSpot',{rank:spot.rank,level:spot.level}));
    el.addEventListener('click',e=>{e.stopPropagation();onSpot(spot.spot_id);});
    markers.push(new lib.Marker({element:el}).setLngLat([spot.lon,spot.lat]).addTo(map.current));
   }
  });
  return ()=>{cancelled=true;markers.forEach(marker=>marker.remove());};
 },[regions,region,spots,onRegion,onSpot,ready,locale,t]);
 return <div className="risk-map-wrap"><div ref={container} className="risk-map" data-testid="risk-map" />
  <p className="risk-map-note">{failed?t('mapFailed'):tilesUnavailable?t('tilesUnavailable'):t('mapHint')}</p>
 </div>;
}
