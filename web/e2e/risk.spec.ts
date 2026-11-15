import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Required for all headless input, including a future shell integration.
test.use({ launchOptions: { args: ['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({page}) => { await page.clock.setFixedTime(new Date('2026-11-15T12:00:00')); });
const exampleFile=(path:string)=>readFileSync(join(process.cwd(),'public/data/risk/example',path),'utf8');

test('engine not ready shows the placeholder and official services',async({page})=>{
 await page.route('**/data/risk/meta.json',route=>route.fulfill({json:{...JSON.parse(exampleFile('meta.json')),example:false,engine_ready:false}}));
 await page.goto('/risk');
 await expect(page.getByRole('heading',{name:"Tomorrow's fire risk: being built and tested. Here is what it will show."})).toBeVisible();
 await expect(page.getByRole('link',{name:'EFFIS',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'112',exact:true})).toHaveAttribute('href','tel:112');
 await expect(page.getByText('Example data',{exact:false})).toHaveCount(0);
 await expect(page.getByRole('combobox')).toHaveCount(0);
 await expect(page.locator('.risk-placeholder li')).toHaveCount(3);
 await expect(page.getByRole('link',{name:'How we know it is right'})).toHaveAttribute('href','/proof#next-day-risk');
});

test('example outlook supports days, regions, map picks, probability and history',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/data/risk/example/week/BGR.json',route=>route.fulfill({json:{...JSON.parse(exampleFile('week/BGR.json')),ranking:{'2026-11-16':'model','2026-11-17':'history'}}}));
 await page.goto('/risk?risk=example');
 await expect(page.getByText('Example data',{exact:false})).toBeVisible();
 await expect(page.getByRole('link',{name:'How we know it is right'})).toHaveAttribute('href','/proof?risk=example#next-day-risk');
 await expect(page.getByRole('button',{name:'Tomorrow',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.risk-list > li')).toHaveCount(10);
 await expect(page.getByRole('button',{name:'Week',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Week',exact:true}).click();
 const weekCard=JSON.parse(readFileSync(join(process.cwd(),'public/data/risk/scorecard.json'),'utf8'));
 const lead4=weekCard.week.leads['4'].scopes.world.selections.forest_wildland.pooled.methods;
 const percent=(n:number)=>new Intl.NumberFormat('en',{style:'percent',maximumFractionDigits:1}).format(n);
 await expect(page.getByText(`Day 4 ahead: ranked by the model. It caught ${percent(lead4.model.capture_rate)} of new fires in 2025 worldwide, forest and wildland [V].`)).toBeVisible();
 await page.getByRole('button',{name:'2026-11-17',exact:true}).click();
 const lead5=weekCard.week.leads['5'].scopes.world.selections.forest_wildland.pooled.methods;
 await expect(page.getByText(`Day 5 ahead: ranked by fire history. It caught ${percent(lead5.history.capture_rate)} of new fires in 2025 worldwide, forest and wildland [V].`)).toBeVisible();
 for (const width of [375,1280]) {
  await page.setViewportSize({width,height:1000});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.locator('.risk-sheet').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath(`week-${width}.png`)});
 }
 await page.setViewportSize({width:1280,height:720});
 await expect(page.locator('.risk-list > li').first()).toBeVisible();
 await page.getByRole('button',{name:'Tomorrow',exact:true}).click();
 await page.getByLabel('Region',{exact:true}).selectOption('BG-02');
 await expect(page.getByRole('heading',{name:'Burgas',exact:true})).toBeVisible();
 await expect(page.locator('.risk-list > li').first()).toContainText('42.05, 27.45');
 await page.getByRole('button',{name:'Today',exact:true}).click();
 await expect(page.getByText('Valid for 2026-11-14')).toBeVisible();
 await page.locator('.risk-list summary').first().click();
 await expect(page.locator('.risk-list details').first()).toContainText('12.5%');
 await expect(page.locator('.risk-list > li').last()).toContainText('no forecast here');
 await expect(page.getByRole('link',{name:'History here'}).first()).toHaveAttribute('href',/sel=p:42.05,27.45,/);
 await page.getByLabel('Country',{exact:true}).selectOption('USA');
 await expect(page.getByRole('heading',{name:'California',exact:true})).toBeVisible();
 await expect(page.locator('.risk-list > li').first()).toContainText('38.55, -120.75');
 await page.getByLabel('Country',{exact:true}).selectOption('BGR');
 await expect(page.getByRole('button',{name:'Spot 1, Level 4',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Spot 1, Level 4',exact:true}).click();
 await expect(page.locator('.risk-list > li').first()).toBeFocused();
 // A neighbouring region label is a geographic, keyboard-accessible map pick.
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 await page.getByRole('button',{name:'Choose Sofia Province',exact:true}).click();
 await expect(page.getByLabel('Region',{exact:true})).toHaveValue('BG-23');
 expect(errors).toEqual([]);
});

test('real files become visible through metadata only',async({page})=>{
 await page.route('**/data/risk/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/data/risk/','');
  if(path==='scorecard.json')return route.fulfill({status:404,body:''});
  if(path==='meta.json')return route.fulfill({json:{...JSON.parse(exampleFile(path)),engine_ready:true,example:false}});
  return route.fulfill({contentType:'application/json',body:exampleFile(path)});
 });
 await page.goto('/risk');
 await expect(page.locator('.risk-list > li')).toHaveCount(10);
 await expect(page.locator('.risk-example')).toHaveCount(0);
});

test('real week uses its exported ranking and measured score',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const week=JSON.parse(readFileSync(join(process.cwd(),'public/data/risk/week/BGR.json'),'utf8'));
 const card=JSON.parse(readFileSync(join(process.cwd(),'public/data/risk/scorecard.json'),'utf8'));
 await page.goto('/risk');
 await page.getByLabel('Country',{exact:true}).selectOption('BGR');
 await page.getByLabel('Region',{exact:true}).selectOption('BG-01');
 await page.getByRole('button',{name:'Week',exact:true}).click();
 const day=week.days[0];
 const lead=(Date.parse(`${day}T00:00:00Z`)-Date.parse(`${week.run_date}T00:00:00Z`))/86400000;
 expect(week.ranking[day]).toBe('model');
 const score=card.week.leads[String(lead)].scopes.world.selections.forest_wildland.pooled.methods.model.capture_rate;
 const percent=new Intl.NumberFormat('en',{style:'percent',maximumFractionDigits:1}).format(score);
 await expect(page.getByText(`Day ${lead} ahead: ranked by the model. It caught ${percent} of new fires in 2025 worldwide, forest and wildland [V].`)).toBeVisible();
 await expect(page.locator('.risk-list > li').first()).toBeVisible();
 const fwi=new Intl.NumberFormat('en',{maximumFractionDigits:1}).format(week.regions['BG-01'][day][0].inputs.fwi);
 await expect(page.locator('.risk-list > li').first()).toContainText(`NASA fire-weather index: ${fwi}`);
 for(const width of [375,1280]){
  await page.setViewportSize({width,height:1000});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`week-real-${width}.png`)});
 }
 expect(errors).toEqual([]);
});

test('missing country remains an empty labelled state',async({page})=>{
 await page.route('**/data/risk/example/latest/USA.json',route=>route.fulfill({status:404,body:''}));
 await page.goto('/risk?risk=example');
 await expect(page.locator('.risk-list > li')).toHaveCount(10);
 await page.getByLabel('Country',{exact:true}).selectOption('USA');
 await expect(page.getByText('No forecast file is available for this country.')).toBeVisible();
 await expect(page.locator('.risk-list > li')).toHaveCount(0);
});

test('outlook renders without horizontal scroll at every required width',async({page},testInfo)=>{
 await page.goto('/risk?risk=example');
 await expect(page.locator('.risk-list > li')).toHaveCount(10);
 await expect(page.getByRole('button',{name:'Spot 1, Level 4',exact:true})).toBeVisible();
 for(const width of [320,375,600,700,768,820,1024,1280]) {
  await page.setViewportSize({width,height:900});
  await expect.poll(()=>page.locator('.risk-map').evaluate(el=>Math.abs((el.querySelector('canvas')?.clientWidth??0)-el.clientWidth)<1)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  if(width===375||width===1280)await page.screenshot({path:testInfo.outputPath(`risk-${width}.png`),fullPage:true});
 }
});

test('Bulgarian outlook and placeholder keep the same controls and fit a phone',async({page,context},testInfo)=>{
 await context.addCookies([{name:'emerge-locale',value:'bg',url:process.env.EMERGE_E2E_URL??`http://localhost:${process.env.EMERGE_E2E_PORT??4311}`}]);
 await page.setViewportSize({width:375,height:900});
 await page.goto('/risk?risk=example');
 await expect(page.getByRole('heading',{name:'Прогноза за риска (неофициална)'})).toBeVisible();
 await expect(page.getByLabel('Област',{exact:true})).toHaveValue('BG-01');
 await page.getByLabel('Област',{exact:true}).selectOption('BG-02');
 await expect(page.getByRole('heading',{name:'Бургас',exact:true})).toBeVisible();
 await expect(page.locator('.risk-list > li')).toHaveCount(10);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await expect(page.getByRole('button',{name:'Място 1, Ниво 4',exact:true})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('risk-bg-375.png'),fullPage:true});
 await page.getByRole('button',{name:'Седмица',exact:true}).click();
 await expect(page.getByText('Методът за подреждане не е наличен за този ден.')).toBeVisible();
 await page.route('**/data/risk/meta.json',route=>route.fulfill({json:{...JSON.parse(exampleFile('meta.json')),example:false,engine_ready:false}}));
 await page.goto('/risk');
 await expect(page.getByRole('heading',{name:'Рискът от пожар утре: в процес на разработка и проверка. Ето какво ще показва.'})).toBeVisible();
 await expect(page.locator('.risk-placeholder li')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('risk-placeholder-bg-375.png'),fullPage:true});
});


test('farmland region switches to all vegetation and stale forecasts use dates',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-11-17T12:00:00'));
 await page.goto('/risk');
 await page.getByLabel('Country',{exact:true}).selectOption('BGR');
 await page.getByLabel('Region',{exact:true}).selectOption('BG-03');
 await expect(page.getByText('No forest or wildland spots are available in this region for this date.')).toBeVisible();
 await expect(page.getByText('Forecast made for 2026-11-15; not updated since')).toBeVisible();
 await expect(page.getByRole('button',{name:'Tomorrow',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Show all vegetation fires'}).click();
 await expect(page.getByRole('button',{name:'All vegetation fires',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.risk-list > li')).toHaveCount(4);
 await expect(page.locator('.risk-list > li').first()).toContainText('farmland');
});
