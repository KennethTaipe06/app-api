/**
 * Valida la cedula ecuatoriana segun el algoritmo del digito verificador.
 * Traduccion del algoritmo Java de referencia (Modulo 10 adaptado).
 *
 * Reglas:
 *  - Longitud exacta: 10 digitos
 *  - Los primeros 2 digitos corresponden a la provincia (01-24, 30)
 *  - El digito 3 debe ser < 6 (personas naturales)
 *  - Algoritmo Modulo 10 sobre los primeros 9 digitos
 */
export function validateCedulaEcuatoriana(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const x = input.trim();
  if (x.length !== 10) return false;
  if (!/^\d{10}$/.test(x)) return false;

  // Validar codigo de provincia
  const provincia = parseInt(x.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  // El tercer digito debe ser < 6 para personas naturales
  const tercero = parseInt(x.charAt(2), 10);
  if (tercero >= 6) return false;

  const a: number[] = new Array(Math.floor(x.length / 2));
  const b: number[] = new Array(Math.floor(x.length / 2));
  let c = 0;
  let d = 1;
  let suma = 0;

  for (let i = 0; i < Math.floor(x.length / 2); i++) {
    a[i] = parseInt(x.charAt(c), 10);
    c += 2;
    if (i < Math.floor(x.length / 2) - 1) {
      b[i] = parseInt(x.charAt(d), 10);
      d += 2;
    } else {
      b[i] = 0;
    }
  }

  for (let i = 0; i < a.length; i++) {
    a[i] *= 2;
    if (a[i] > 9) a[i] -= 9;
    suma += a[i] + b[i];
  }

  const dec = (Math.floor(suma / 10) + 1) * 10;
  if (dec - suma === parseInt(x.charAt(9), 10)) return true;
  return suma % 10 === 0 && x.charAt(9) === '0';
}
