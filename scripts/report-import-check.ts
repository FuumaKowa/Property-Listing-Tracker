import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
assert.ok(existsSync('src/reportImport.ts'), 'Report parser must exist');
const { parsePublicationReport, matchReportChannel } = await import('../src/reportImport');
const report = `*Eksklusif Pangsapuri RSKU @ Seksyen U9, Shah Alam RM 288 K*
OWNER LISTING
NAME : Example owner
TEL : Not captured
1. Propguru
https://www.propertyguru.com.my/property-listing/for-sale-by-dr-shahril-nizam-501565067
2. Iprop
https://www.iproperty.com.my/property/shah-alam/eksklusif-pangsapuri-rsku-seksyen-u-9-shah-alam/sale-501565067/
3. Propmall
https://propmall.my/share/qfw4f2qdwa
4. Tele Nhc Coa
https://t.me/affliaterumahpemaju/781
5. Tele Nhc
6. Tele Mgn
5. Rumah Pemaju FB
https://www.facebook.com/share/p/19auLxXfT2/
6. Marketplace FB - pending maximum attempt reached
7. Instagram
https://www.instagram.com/p/Dch8ky_INmm/?utm_source=ig_web_copy_link&igsi=MzRlODBiNWFlZA==
8. Threads
https://www.threads.com/share/GlubXSWsY/
9. Tiktok
 https://www.tiktok.com/@rumahlotnhc/photo/7678567863929589012?is_from_webapp=1&sender_device=pc
10. Mudah`;
const rows = parsePublicationReport(report);
assert.equal(rows.filter(r => r.url && !r.issue).length, 8, 'All eight published URLs must survive');
assert.equal(rows.filter(r => !r.url).length, 4, 'Missing/pending entries must remain visible');
assert.equal(rows.length, 12, 'Owner metadata must not become advertisement entries');
assert.equal(rows[3].label, 'Tele Nhc Coa');
assert.equal(rows[8].url?.split('igsi=')[1], 'MzRlODBiNWFlZA==', 'Do not truncate URL parameters');
const channels = ['PropertyGuru','IProperty','PropMall','Telegram','Facebook','Instagram','Threads','TikTok','Mudah','Marketplace'].map((name,i)=>({id:i+1,name,archivedAt:null}));
assert.deepEqual(rows.filter(r=>r.url).map(r=>matchReportChannel(r,channels)), [1,2,3,4,5,6,7,8]);
assert.equal(matchReportChannel(rows[3],[...channels,{id:50,name:'Tele Nhc Coa',archivedAt:null}]),50,'Exact custom channel wins');
assert.equal(matchReportChannel(rows[3],[{id:1,name:'Telegram A',archivedAt:null},{id:2,name:'Telegram B',archivedAt:null}]),null,'Do not guess between channels');
assert.equal(matchReportChannel(rows[0],[{id:1,name:'PropertyGuru',archivedAt:'2020'}]),null,'Archived channels cannot receive imports');
assert.equal(matchReportChannel({label:'Instagram',url:'https://www.tiktok.com/@x/video/1'},channels),null,'Conflicting label/domain needs review');
assert.equal(matchReportChannel({label:'Marketplace FB',url:'https://www.facebook.com/marketplace/item/12'},channels),10);
assert.equal(parsePublicationReport('1) Propguru: https://www.propertyguru.com.my/x')[0].label,'Propguru');
assert.equal(parsePublicationReport('Telegram\nhttps://t.me/test/1\nhttps://t.me/test/2').length,2);
const custom = parsePublicationReport('Telegram\nhttps://t.me/test/1\nAgency Website\nhttps://agency.example/listing/1');
assert.equal(custom[1].label,'Agency Website');
assert.equal(matchReportChannel(custom[1],channels),null,'Custom headings must not inherit the previous platform');
assert.deepEqual(parsePublicationReport('1. Tele Nhc Coa\n<https://t.me/test/1>'),[{label:'Tele Nhc Coa',url:'https://t.me/test/1',issue:undefined}]);
assert.equal(parsePublicationReport('1. Website\njavascript:alert(1)')[0].url,null);
assert.ok(parsePublicationReport('1. Website\nhttps://user:password@example.com/post')[0].issue);
assert.equal(parsePublicationReport('1. Site\n[View](https://example.com/post)')[0].url,'https://example.com/post');
assert.equal(matchReportChannel({label:'Unknown',url:'https://evil-facebook.com/post'},channels),null);
assert.throws(()=>parsePublicationReport('x'.repeat(50001)));
console.log('PASS report parsing, eight sample URLs, missing/pending entries, aliases, custom channels, ambiguous matches and unsafe URLs');
