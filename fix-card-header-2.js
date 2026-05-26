const fs = require('fs');

const filePath = '/workspace/projects/src/app/maintenance/page.tsx';
const content = fs.readFileSync(filePath, 'utf8');

// 查找并替换有问题的Select部分
const oldSelect = `                      <Select value={String(contractYears)} onValueChange={(v) => setContractYears(Number(v) as 1 | 2 | 3)}>`;

const newSelect = `                      <Select value={contractYears} onValueChange={setContractYears}>`;

const newContent = content.replace(oldSelect, newSelect);
fs.writeFileSync(filePath, newContent);
console.log('✅ Select updated successfully!');
