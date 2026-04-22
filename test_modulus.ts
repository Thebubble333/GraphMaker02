function replaceModulus(expr: string): { parsed: string, absExpressions: string[] } {
    let res = "";
    const absExpressions: string[] = [];
    const stack: number[] = []; // stores the index in `res` where 'abs(' was inserted
    
    let i = 0;
    while (i < expr.length) {
        const char = expr[i];
        if (char === '|') {
            let isOpening = false;
            
            if (stack.length === 0) {
                isOpening = true;
            } else {
                let prevChar = '';
                for (let j = i - 1; j >= 0; j--) {
                    if (expr[j] !== ' ') {
                        prevChar = expr[j];
                        break;
                    }
                }
                
                if (prevChar === '' || '+-*/^=<>,([{'.includes(prevChar)) {
                    isOpening = true;
                } else if ('0123456789xyz)'.includes(prevChar.toLowerCase())) {
                    isOpening = false;
                } else if (prevChar === '|') {
                    let nextChar = '';
                    for (let j = i + 1; j < expr.length; j++) {
                        if (expr[j] !== ' ') {
                            nextChar = expr[j];
                            break;
                        }
                    }
                    if (nextChar === '' || '+-*/^=<>,)]}'.includes(nextChar)) {
                        isOpening = false;
                    } else {
                        isOpening = true;
                    }
                } else {
                    isOpening = false;
                }
            }
            
            if (isOpening) {
                stack.push(res.length);
                res += "abs(";
            } else {
                const openIdx = stack.pop()!;
                res += ")";
                const innerExpr = res.substring(openIdx + 4, res.length - 1);
                absExpressions.push(innerExpr);
            }
        } else {
            res += char;
        }
        i++;
    }
    
    return { parsed: res, absExpressions };
}

console.log(replaceModulus("|sin(|x|)|"));
console.log(replaceModulus("|x| + |y|"));
console.log(replaceModulus("||x| - 1|"));
console.log(replaceModulus("|x||y|"));
