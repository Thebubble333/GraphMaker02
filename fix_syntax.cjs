const fs = require('fs');
let code = fs.readFileSync('pages/NetworkGrapher.tsx', 'utf8');

const regex = /                        \)\}\n                        \)\}\n\n                        \{inputType === 'precedence'/;

code = code.replace(regex, `                        )}

                        {inputType === 'precedence'`);

const regex2 = /                            <\/div>\n                        \n                        \{inputType === 'manual' && singleSelectedNode && \(/;
code = code.replace(regex2, `                            </div>
                        )}
                        {inputType === 'manual' && singleSelectedNode && (`);

fs.writeFileSync('pages/NetworkGrapher.tsx', code);
console.log('Fixed syntax error');
