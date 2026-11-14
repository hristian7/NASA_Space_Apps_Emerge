import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadRiskHere } from '../../src/lib/risk/here';
import { loadRiskIndex } from '../../src/lib/risk/loaders';
const paths:string[]=[];
const fixtureFetch=(async (input:RequestInfo|URL)=>{
 const path=String(input);paths.push(path);
 try { return new Response(readFileSync(new URL(`../../public${path}`,import.meta.url),'utf8'),{status:200}); }
 catch { return new Response(null,{status:404}); }
}) as typeof fetch;
it('loads only a nearby country and finds tomorrow at the requested point',async()=>{
 const index=await loadRiskIndex(true,fixtureFetch);paths.length=0;
 const spot=await loadRiskHere(index,41.95,23.35,true,fixtureFetch);
 expect(spot).toMatchObject({lat:41.95,lon:23.35,day:'2026-11-15',rank:1,p:.14});
 expect(paths).toEqual(['/data/risk/example/latest/BGR.json']);
});
it('preserves no-forecast and outside-coverage results in the card lookup',async()=>{
 const index=await loadRiskIndex(true,fixtureFetch);
 expect((await loadRiskHere(index,42.05,23.75,true,fixtureFetch))?.p).toBeNull();
 expect(await loadRiskHere(index,0,0,true,fixtureFetch)).toBeNull();
 expect(await loadRiskHere(index,NaN,0,true,fixtureFetch)).toBeNull();
});
