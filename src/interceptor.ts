import { DwgType } from "albatros/enums";

type MeshTriangle = { mesh: DwgMesh; triangleIndex: number };

export class IntersectionFinder {
    private editor: DwgEntityEditor ;
    private drawing :Drawing;
    private context: Context;

    constructor(context: Context) {
        this.context = context;
        this.editor = context.cadview?.layer?.drawing?.layout.drawing?.layouts.model!.editor()!;
        this.drawing = context.cadview?.layer?.drawing?.layout.drawing!;
    }



    public async createIntersectionModel(model1: DwgModel3d, model2: DwgModel3d): Promise<DwgModel3d> {
        // 1. Вычисляем мировые ограничивающие коробки и их пересечение
        const box1World = this.getWorldBoundingBox(model1);
        const box2World = this.getWorldBoundingBox(model2);
        const intersectionBoxWorld = this.computeIntersectionBox(box1World, box2World);
        if (!intersectionBoxWorld) {
            return this.createEmptyDwgModel3d();
        }
    
        // 2. Получаем кандидатные треугольники
        const candidateTriangles1 = this.getCandidateTriangles(model1, intersectionBoxWorld);
        const candidateTriangles2 = this.getCandidateTriangles(model2, intersectionBoxWorld);
    
        // 3. Находим пересечения треугольников и вычисляем линии пересечения
        const intersectionLines = await this.computeTriangleIntersections(model1, model2, candidateTriangles1, candidateTriangles2);
    
        // 4. Создаем геометрию из линий пересечения
        const intersectionGeometry = this.createGeometryFromIntersectionLines(intersectionLines);
        // 5. Для отладки рисуем линии пересечения как полилинии
        this.editor.beginEdit();
        await this.drawGeometryTrianglesAsPolylines(this.editor, intersectionGeometry, 3);
     //   await this.drawTrianglesAsPolylines(this.editor, candidateTriangles1, model1.matrix, 4);
     //   await this.drawTrianglesAsPolylines(this.editor, candidateTriangles2, model2.matrix, 5);
        this.editor.endEdit();
    
        // 6. Создаем новую модель
        const uuidGeometry = await Math3d.geometry.createUuidGeometry3d(intersectionGeometry);
        const newModel = await this.editor?.addMesh({
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        const geometry = await this.drawing.geometries.add(uuidGeometry);
        await newModel?.addMesh({ geometry: geometry });
    
        return newModel;
    }
    
    // Вспомогательный метод для вычисления пересечений треугольников
    private async computeTriangleIntersections(
        model1: DwgModel3d,
        model2: DwgModel3d,
        triangles1: MeshTriangle[],
        triangles2: MeshTriangle[]
    ): Promise<{ a: vec3; b: vec3 }[]> {
        const intersectionLines: { a: vec3; b: vec3 }[] = [];
        const model1Matrix = model1.matrix;
        const model2Matrix = model2.matrix;
    
        // Инвертируем матрицы для преобразования в локальные координаты
        const model1MatrixInv = Math3d.mat4.inverse(Math3d.mat4.alloc(), model1Matrix);
        const model2MatrixInv = Math3d.mat4.inverse(Math3d.mat4.alloc(), model2Matrix);
    
        // Проходим по всем парам кандидатных треугольников
        for (const t1 of triangles1) {
            const { mesh: mesh1, triangleIndex: idx1 } = t1;
            const geo1 = mesh1.geometry;
            const vertices1Local = this.getTriangleVertices(geo1, idx1);
            const vertices1World = vertices1Local.map(v => Math3d.mat4.mulv3([0, 0, 0], model1Matrix, v));
            console.log("Vertices1World:", vertices1World.slice(0, 3));
            for (const t2 of triangles2) {
                const { mesh: mesh2, triangleIndex: idx2 } = t2;
                const geo2 = mesh2.geometry;
                const vertices2Local = this.getTriangleVertices(geo2, idx2);
                const vertices2World = vertices2Local.map(v => Math3d.mat4.mulv3([0, 0, 0], model2Matrix, v));
    
                // Проверяем пересечение треугольников
                if (vertices1World.length === 3 && vertices2World.length === 3) {
                    const intersection = this.intersectTriangles(vertices1World as [vec3, vec3, vec3], vertices2World as [vec3, vec3, vec3]);
                  
                    if (intersection) {
                        intersectionLines.push(intersection);
                    }
                }
            }
        }
    
        return intersectionLines;
    }
    
    private intersectTriangles(t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): { a: vec3; b: vec3 } | null {
        const plane1 = this.getPlaneFromTriangle(t1);
        const plane2 = this.getPlaneFromTriangle(t2);
    
        const intersections1 = this.getIntersections(t2, plane1, t1);
        const intersections2 = this.getIntersections(t1, plane2, t2);
    
        const allIntersections = this.removeDuplicatePoints([...intersections1, ...intersections2]);
    
        if (allIntersections.length < 2) {
            return null;
        }
    
        const { pointA, pointB } = this.findFurthestPoints(allIntersections);
    
        if (pointA && pointB && this.isValidIntersection(pointA, pointB, t1, t2)) {
            return { a: pointA, b: pointB };
        }
    
        return null;
    }

    private getPlaneFromTriangle(t: [vec3, vec3, vec3]): { normal: vec3; d: number } {
        const v1 = Math3d.vec3.sub([0, 0, 0], t[1], t[0]);
        const v2 = Math3d.vec3.sub([0, 0, 0], t[2], t[0]);
        const crossProduct: vec3 = [0, 0, 0];
        Math3d.vec3.cross(crossProduct, v1, v2);
        const normal: vec3 = [0, 0, 0];
        Math3d.vec3.normalize(normal, crossProduct);
        const d = -Math3d.vec3.dot(normal, t[0]);
        return { normal, d };
    }

    private isPointInsideTriangle(p: vec3, t: [vec3, vec3, vec3]): boolean {
        const [a, b, c] = t;
        const v0 = Math3d.vec3.sub([0, 0, 0], b, a);
        const v1 = Math3d.vec3.sub([0, 0, 0], c, a);
        const v2 = Math3d.vec3.sub([0, 0, 0], p, a);
        const dot00 = Math3d.vec3.dot(v0, v0);
        const dot01 = Math3d.vec3.dot(v0, v1);
        const dot02 = Math3d.vec3.dot(v0, v2);
        const dot11 = Math3d.vec3.dot(v1, v1);
        const dot12 = Math3d.vec3.dot(v1, v2);
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return u >= 0 && v >= 0 && u + v <= 1;
    }

    private getIntersections(triangle: [vec3, vec3, vec3], plane: { normal: vec3; d: number }, otherTriangle: [vec3, vec3, vec3]): vec3[] {
        const intersections: vec3[] = [];
        for (let i = 0; i < 3; i++) {
            const a = triangle[i];
            const b = triangle[(i + 1) % 3];
            const da = Math3d.vec3.dot(plane.normal, a) + plane.d;
            const db = Math3d.vec3.dot(plane.normal, b) + plane.d;
            if (da * db < 0) { // Ребро пересекает плоскость
                const t = da / (da - db);
                const point: vec3 = [0, 0, 0];
                const dir: vec3 = [0, 0, 0];
                Math3d.vec3.sub(dir, b, a);
                Math3d.vec3.mul(dir, dir, t);
                Math3d.vec3.add(point, a, dir);
                if (this.isPointInsideTriangle(point, otherTriangle)) {
                    intersections.push(point);
                }
            }
        }
        return intersections;
    }


    private findFurthestPoints(points: vec3[]): { pointA: vec3; pointB: vec3 } {
        let maxDist = 0;
        let pointA: vec3 | null = null;
        let pointB: vec3 | null = null;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist = Math3d.vec3.distance(points[i], points[j]);
                if (dist > maxDist) {
                    maxDist = dist;
                    pointA = points[i];
                    pointB = points[j];
                }
            }
        }
        return { pointA: pointA!, pointB: pointB! };
    }

    private isValidIntersection(pointA: vec3, pointB: vec3, t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): boolean {
        const midPoint: vec3 = [0, 0, 0];
        const dir: vec3 = [0, 0, 0];
        Math3d.vec3.sub(dir, pointB, pointA);
        Math3d.vec3.mul(dir, dir, 0.5);
        Math3d.vec3.add(midPoint, pointA, dir);
        return (
            this.isPointInsideTriangle(pointA, t1) && this.isPointInsideTriangle(pointB, t1) &&
            this.isPointInsideTriangle(pointA, t2) && this.isPointInsideTriangle(pointB, t2) &&
            this.isPointInsideTriangle(midPoint, t1) && this.isPointInsideTriangle(midPoint, t2)
        );
    }

    private removeDuplicatePoints(points: vec3[]): vec3[] {
        const epsilon = 1e-6;
        return points.filter((p, i, arr) => 
            arr.findIndex(q => Math3d.vec3.distance(p, q) < epsilon) === i
        );
    }

    private handleCoplanarTriangles(t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): { a: vec3; b: vec3 } | null {
        console.warn("Копланарные треугольники обнаружены, но обработка не реализована.");
        return null; // Требуется доработка для полной поддержки
    }
 
    private getPlaneIntersectionLine(plane1: { normal: vec3; d: number }, plane2: { normal: vec3; d: number }): ray3 | null {
        const direction = Math3d.vec3.cross([0, 0, 0], plane1.normal, plane2.normal);
        if (Math3d.vec3.len(direction) < 1e-6) {
            return null; // Плоскости параллельны
        }
        const point = this.findPointOnPlaneIntersection(plane1, plane2);
        if (!point) {
            return null;
        }
        return Math3d.ray3.make([0, 0, 0, 0, 0, 0], point, direction);
    }

    private findPointOnPlaneIntersection(plane1: { normal: vec3; d: number }, plane2: { normal: vec3; d: number }): vec3 | null {
        const n1 = plane1.normal;
        const n2 = plane2.normal;
        const d1 = plane1.d;
        const d2 = plane2.d;
        const cross = Math3d.vec3.cross([0, 0, 0], n1, n2);
        if (Math3d.vec3.len(cross) < 1e-6) {
            return null;
        }
        const a = n1[0], b = n1[1], c = n2[0], d = n2[1];
        const det = a * d - b * c;
        if (Math.abs(det) < 1e-6) {
            return null;
        }
        const x = (-d1 * d - (-d2 * b)) / det;
        const y = (-a * (-d2) - c * (-d1)) / det;
        const z = 0;
        return [x, y, z];
    }

    private getTriangleLineIntersection(t: [vec3, vec3, vec3], line: ray3): { a: vec3; b: vec3 } | null {
        const intersections: vec3[] = [];
        for (let i = 0; i < 3; i++) {
            const a = t[i];
            const b = t[(i + 1) % 3];
            const ray = Math3d.ray3.make([0, 0, 0, 0, 0, 0], a, Math3d.vec3.sub([0, 0, 0], b, a));
            const tParam = Math3d.ray3.intrLine3Line3(ray, line);
            if (tParam && tParam.s1 >= 0 && tParam.s1 <= 1) {
                const point = Math3d.ray3.at([0, 0, 0], ray, tParam.s1);
                intersections.push(point);
            }
        }
        if (intersections.length < 2) {
            return null;
        }
        const uniquePoints = [...new Set(intersections.map(p => p.toString()))].map(s => intersections.find(p => p.toString() === s)!);
        if (uniquePoints.length >= 2) {
            return { a: uniquePoints[0], b: uniquePoints[1] };
        }
        return null;
    }

    private getSegmentIntersection(seg1: { a: vec3; b: vec3 }, seg2: { a: vec3; b: vec3 }): { a: vec3; b: vec3 } | null {
        const points = [seg1.a, seg1.b, seg2.a, seg2.b];
        const sortedPoints = points.sort((p1, p2) => Math3d.vec3.distance(p1, seg1.a) - Math3d.vec3.distance(p2, seg1.a));
        const start = sortedPoints[1];
        const end = sortedPoints[2];
        if (Math3d.vec3.distance(start, end) > 1e-6) {
            return { a: start, b: end };
        }
        return null;
    }

    // Создание геометрии из линий пересечения
    private createGeometryFromIntersectionLines(lines: { a: vec3; b: vec3 }[]): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex = 0;
    
        for (const line of lines) {
            vertices.push(...line.a, ...line.b);
            indices.push(vertexIndex, vertexIndex + 1);
            vertexIndex += 2;
        }
    
        const geometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length), // Нормали пока не вычисляем
            indices: new Uint32Array(indices),
        };
    
        Math3d.geometry.calculateNormals(geometry);
        return geometry;
    }
    private async drawGeometryTrianglesAsPolylines(editor: DwgEntityEditor, geometry: Geometry3d, color : number) {
        const { vertices, indices } = geometry;
    
        // Проверяем, что количество индексов кратно 3 (каждый треугольник — 3 вершины)
        if (indices.length % 3 !== 0) {
            console.error("Некорректное количество индексов в geometry.indices. Должно быть кратно 3.");
            return;
        }
    
        // Проходим по всем треугольникам
        for (let i = 0; i < indices.length; i += 3) {
            // Извлекаем индексы вершин текущего треугольника
            const idx0 = indices[i];
            const idx1 = indices[i + 1];
            const idx2 = indices[i + 2];
    
            // Получаем координаты вершин из массива vertices
            const v0: vec3 = [vertices[idx0 * 3], vertices[idx0 * 3 + 1], vertices[idx0 * 3 + 2]];
            const v1: vec3 = [vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]];
            const v2: vec3 = [vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]];
    
            // Создаем массив вершин для замкнутой полилинии: v0 -> v1 -> v2 -> v0
            const polylineVertices = [v0, v1, v2, v0];
    
    
            // Добавляем полилинию в редактор
            await this.drawTriangleAsPolyline(editor, polylineVertices, color);
        }
    }
 
    private async drawTrianglesAsPolylines(editor: DwgEntityEditor, triangles: MeshTriangle[], modelMatrix: mat4,color : number) {
        for (const { mesh, triangleIndex } of triangles) {
            const geometry = mesh.geometry;
            const triangleVertices = this.getTriangleVertices(geometry, triangleIndex); // Извлекаем вершины треугольника
            const worldVertices = triangleVertices.map(v => {
                const worldVec: vec3 = [0, 0, 0];
                return Math3d.mat4.mulv3(worldVec, modelMatrix, v); // Преобразование в мировые координаты
            });
    
            // Добавляем треугольник как полилинию
            await this.drawTriangleAsPolyline(editor, worldVertices, color);
        }
    }

    private async drawTriangleAsPolyline(editor: DwgEntityEditor, verticesWorld: vec3[],color : number ) {
        // Проверяем, что передано ровно 3 вершины для треугольника
        /*if (verticesWorld.length !== 3) {
            console.error("Некорректное количество вершин для треугольника. Требуется ровно 3, получено:", verticesWorld.length);
            return;
        }*/
        
        for(var i = 0; i < verticesWorld.length - 1; i ++){
            const line :  Partial<DwgLineData> = {
                color: color, 
                a:  verticesWorld [i],
                b:  verticesWorld [i+1],            
            };
            await editor.addLine(line);
        }
        // Формируем массив вершин для замкнутой полилинии: A, B, C, A
        const line :  Partial<DwgLineData> = {
            color: color, 
            a:  verticesWorld [verticesWorld.length],
            b:  verticesWorld [0]                
        };
        // Добавляем полилинию в редактор
        await editor.addPolyline(line);
    }
    
    private mergeGeometries(geo1: Geometry3d, geo2: Geometry3d): Geometry3d {
        const vertices = new Float32Array(geo1.vertices.length + geo2.vertices.length);
        vertices.set(geo1.vertices, 0);
        vertices.set(geo2.vertices, geo1.vertices.length);
    
        const normals = new Float32Array(geo1.normals.length + geo2.normals.length);
        normals.set(geo1.normals, 0);
        normals.set(geo2.normals, geo1.normals.length);
    
        const indices = new Uint32Array(geo1.indices.length + geo2.indices.length);
        indices.set(geo1.indices, 0);
        const offset = geo1.vertices.length / 3; // Количество вершин в geo1
        for (let i = 0; i < geo2.indices.length; i++) {
            indices[geo1.indices.length + i] = geo2.indices[i] + offset;
        }
    
        return {
            vertices,
            normals,
            indices,
        };
    }

    private getWorldBoundingBox(model: DwgModel3d): box3 {
        const localBounds = Object.values(model.meshes)[0]?.geometry?.bounds || [0, 0, 0, 0, 0, 0];
        return Math3d.box3.transformed(Math3d.box3.alloc(), localBounds, model.matrix);
    }

    private computeIntersectionBox(box1: box3, box2: box3): box3 | undefined {
        const minX = Math.max(box1[0], box2[0]);
        const minY = Math.max(box1[1], box2[1]);
        const minZ = Math.max(box1[2], box2[2]);
        const maxX = Math.min(box1[3], box2[3]);
        const maxY = Math.min(box1[4], box2[4]);
        const maxZ = Math.min(box1[5], box2[5]);

        if (minX < maxX && minY < maxY && minZ < maxZ) {
            return [minX, minY, minZ, maxX, maxY, maxZ];
        }
        return undefined;
    }

    private getCandidateTriangles(model: DwgModel3d, intersectionBoxWorld: box3): MeshTriangle[] {
        const modelMatrixInverse = Math3d.mat4.inverse(Math3d.mat4.alloc(), model.matrix);
        const intersectionBoxLocal = Math3d.box3.transformed(Math3d.box3.alloc(), intersectionBoxWorld, modelMatrixInverse);
        const candidates: MeshTriangle[] = [];

        for (const mesh of Object.values(model.meshes)) {
            const geometry = mesh.geometry;
            if (geometry && geometry.spatial) {
                const triangleIndices = this.getTrianglesInBox(geometry.spatial, intersectionBoxLocal);
                for (const triangleIndex of triangleIndices) {
                    candidates.push({ mesh, triangleIndex });
                }
            }
        }
        return candidates;
    }

    private getTrianglesInBox(spatial: any, box: box3): number[] {
        const triangles: number[] = [];
        spatial.walkBox(box, (triangleIndex: number) => {
            triangles.push(triangleIndex);
        });
        return triangles;
    }

    private selectTrianglesInsideModel(model: DwgModel3d, otherModel: DwgModel3d, candidateTriangles: MeshTriangle[]): MeshTriangle[] {
        const selected: MeshTriangle[] = [];
        for (const candidate of candidateTriangles) {
            const { mesh, triangleIndex } = candidate;
            const geometry = mesh.geometry;
            const verticesLocal = this.getTriangleVertices(geometry, triangleIndex);
            const vec: vec3 = [0, 0, 0];
            const verticesWorld = verticesLocal.map(v => Math3d.mat4.mulv3(vec, model.matrix, v));
            if (verticesWorld.every(v => this.isPointInsideModel(otherModel, v))) {
                selected.push(candidate);
            }
        }
        return selected;
    }


    private isPointInsideModel(model: DwgModel3d, pointWorld: vec3): boolean {
        const modelMatrixInverse = Math3d.mat4.inverse(Math3d.mat4.alloc(), model.matrix);
        const vec: vec3 = [0, 0, 0];
        const pointLocal = Math3d.mat4.mulv3(vec, modelMatrixInverse, pointWorld);
        for (const mesh of Object.values(model.meshes)) {
            const geometry = mesh.geometry;
            if (geometry && this.isPointInsideGeometry(geometry, pointLocal)) {
                return true;
            }
        }
        return false;
    }

    private randomDirection(): vec3 {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        return [
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ];
    }
    
    private isPointInsideGeometry(geometry: DwgGeometry3d, pointLocal: vec3): boolean {
        const rayDirection: vec3 = this.randomDirection(); // Случайное направление
        const ray = Math3d.ray3.make(Math3d.ray3.alloc(), pointLocal, rayDirection);
        const intersections: number[] = [];
    
        geometry.spatial?.walk(ray, (triangleIndex: number) => {
            const vertices = this.getTriangleVertices(geometry, triangleIndex);
            const t = Math3d.ray3.fireTriangle(ray, vertices[0], vertices[1], vertices[2]);
            if (t !== undefined && t > 0) {
                intersections.push(t);
            }
        });
    
        intersections.sort((a, b) => a - b);
     //   console.log("Point:", pointLocal, "Direction:", rayDirection, "Intersections:", intersections.length);
        return intersections.length % 2 === 1;
    }

    private getTriangleVertices(geometry: DwgGeometry3d|undefined, triangleIndex: number): [vec3, vec3, vec3] {
        const indices = geometry?.indices;
        const vertices = geometry?.vertices;

        if(indices == undefined || vertices == undefined)
            return [[0,0,0], [0,0,0], [0,0,0]];

        const i0 = indices[triangleIndex * 3];
        const i1 = indices[triangleIndex * 3 + 1];
        const i2 = indices[triangleIndex * 3 + 2];
        return [
            [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]],
            [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]],
            [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]],
        ];
    }

    
    private createGeometryFromMeshTriangles(meshTriangles: MeshTriangle[], modelMatrix: mat4): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex = 0;
    
        for (const { mesh, triangleIndex } of meshTriangles) {
            const geometry = mesh.geometry;
            const triangleVertices = this.getTriangleVertices(geometry, triangleIndex);
            const worldVertices = triangleVertices.map(v => {
                const worldVec: vec3 = [0, 0, 0];
                return Math3d.mat4.mulv3(worldVec, modelMatrix, v);
            });
            for (const v of worldVertices) {
                vertices.push(...v);
                indices.push(vertexIndex++);
            }
        }
    
        const newGeometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length), // Изначально пустой массив нужного размера
            indices: new Uint32Array(indices),
        };
    
        Math3d.geometry.calculateNormals(newGeometry);
        return newGeometry;
    }

    
    private async createEmptyDwgModel3d(): Promise<DwgModel3d> {
        const emptyGeometry: Geometry3d = {
            vertices: new Float32Array(),
            normals: new Float32Array(),
            indices: new Uint32Array(),
        };
        const uuidGeometry = await Math3d.geometry.createUuidGeometry3d(emptyGeometry);
        const newModel = await this.editor?.addMesh( {
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        const geometry = await this.drawing.geometries.add(uuidGeometry);

        await newModel?.addMesh({ geometry: geometry });
        return newModel;
    }
}