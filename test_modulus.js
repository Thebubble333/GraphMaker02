function parseModulus(expr) {
    let res = expr;
    let prev = '';
    while (res !== prev) {
        prev = res;
        res = res.replace(/\|([^|]+)\|/g, 'abs($1)');
    }
    return res;
}
console.log(parseModulus('|x| + |x-2|'));
console.log(parseModulus('||x| - 2|'));
console.log(parseModulus('2|x|'));
console.log(parseModulus('|x^2-9|'));
