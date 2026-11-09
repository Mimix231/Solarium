export interface Mesh { positions: Float32Array; normals: Float32Array; triangles: number; size: [number, number, number] }
export const stlLimit = 20 * 1024 * 1024;

export function readStl(bytes: ArrayBuffer): Mesh {
  if (!bytes.byteLength || bytes.byteLength > stlLimit) throw Error('Choose an STL file up to 20 MiB.');
  const view = new DataView(bytes);
  const count = bytes.byteLength >= 84 ? view.getUint32(80, true) : 0;
  let vertices: Float64Array;
  if (count && 84 + count * 50 === bytes.byteLength) {
    vertices = new Float64Array(count * 9);
    for (let face = 0; face < count; face++) for (let axis = 0; axis < 9; axis++) {
      vertices[face * 9 + axis] = view.getFloat32(96 + face * 50 + axis * 4, true);
    }
  } else {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    if (!/^solid(?:\s|$)/i.test(text) || !/\bendsolid\b/i.test(text)) throw Error('Invalid STL header or binary length.');
    const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
    const vector = `(${number})\\s+(${number})\\s+(${number})`;
    const facet = new RegExp(`facet\\s+normal\\s+${vector}\\s+outer\\s+loop\\s+vertex\\s+${vector}\\s+vertex\\s+${vector}\\s+vertex\\s+${vector}\\s+endloop\\s+endfacet`, 'gi');
    const body = text.replace(/^solid[^\r\n]*[\r\n]+/i, '').replace(/endsolid[^\r\n]*$/i, '');
    const values: number[] = [];
    let previous = 0;
    for (const match of body.matchAll(facet)) {
      if (body.slice(previous, match.index).trim()) throw Error('Malformed ASCII STL facet.');
      values.push(...match.slice(4, 13).map(Number));
      previous = match.index + match[0].length;
    }
    if (body.slice(previous).trim()) throw Error('Malformed ASCII STL facet.');
    vertices = Float64Array.from(values);
  }
  if (!vertices.length) throw Error('The STL contains no triangles.');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < vertices.length; index++) {
    const value = vertices[index]!;
    if (!Number.isFinite(value)) throw Error('The STL contains a non-finite vertex.');
    const axis = index % 3;
    min[axis] = Math.min(min[axis]!, value);
    max[axis] = Math.max(max[axis]!, value);
  }
  const size = max.map((value, axis) => value - min[axis]!) as Mesh['size'];
  const extent = Math.max(...size);
  if (!(extent > 0 && Number.isFinite(extent))) throw Error('The STL has invalid bounds.');
  const center = min.map((value, axis) => value + size[axis]! / 2);
  const positions = Float32Array.from(vertices, (value, index) => (value - center[index % 3]!) / extent);
  const normals = new Float32Array(positions.length);
  for (let index = 0; index < positions.length; index += 9) {
    const a = [0, 1, 2].map(axis => positions[index + 3 + axis]! - positions[index + axis]!);
    const b = [0, 1, 2].map(axis => positions[index + 6 + axis]! - positions[index + axis]!);
    const cross = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    const length = Math.hypot(...cross) || 1;
    for (let vertex = 0; vertex < 9; vertex++) normals[index + vertex] = cross[vertex % 3]! / length;
  }
  return { positions, normals, triangles: positions.length / 9, size };
}

export function meshRenderer(canvas: HTMLCanvasElement, mesh: Mesh) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw Error('WebGL is unavailable in this window.');
  const vertex = `attribute vec3 point; attribute vec3 normal;
    uniform vec2 rotation; uniform vec2 scale; varying vec3 n;
    vec3 rotate(vec3 p) {
      float cy=cos(rotation.x), sy=sin(rotation.x), cx=cos(rotation.y), sx=sin(rotation.y);
      vec3 q=vec3(cy*p.x+sy*p.z,p.y,cy*p.z-sy*p.x);
      return vec3(q.x,cx*q.y-sx*q.z,sx*q.y+cx*q.z);
    }
    void main() { vec3 p=rotate(point); n=rotate(normal); gl_Position=vec4(p.xy*scale,p.z,1.0); }`;
  const fragment = `precision mediump float; varying vec3 n;
    void main() { float light=0.31+0.69*abs(dot(normalize(n),normalize(vec3(-0.4,0.6,-1.0))));
      gl_FragColor=vec4(light*vec3(0.35,0.75,0.83),1.0); }`;
  const compile = (type: number, code: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw Error('Could not allocate the mesh shader.');
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw Error('Could not compile the mesh shader.'); }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!program) throw Error('Could not allocate the mesh program.');
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Could not link the mesh program.');
  gl.useProgram(program);
  const buffers = ([['point', mesh.positions], ['normal', mesh.normals]] as const).map(([key, values]) => {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, key);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(location);
    return buffer;
  });
  const rotation = gl.getUniformLocation(program, 'rotation'), scale = gl.getUniformLocation(program, 'scale');
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.05, 0.07, 0.10, 1);
  return {
    draw(yaw: number, pitch: number, zoom: number) {
      const width = Math.max(1, Math.min(2048, Math.round(canvas.clientWidth * devicePixelRatio)));
      const height = Math.max(1, Math.min(2048, Math.round(canvas.clientHeight * devicePixelRatio)));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(rotation, yaw, pitch);
      gl.uniform2f(scale, zoom * Math.min(1, height / width), zoom * Math.min(1, width / height));
      gl.drawArrays(gl.TRIANGLES, 0, mesh.positions.length / 3);
    },
    dispose() { buffers.forEach(buffer => gl.deleteBuffer(buffer)); gl.deleteProgram(program); },
  };
}
