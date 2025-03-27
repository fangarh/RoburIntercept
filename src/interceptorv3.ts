interface MeshTriangle {
    mesh: DwgMesh;
    triangleIndex: number;
}

export class IntersectionFinder3 {
    private editor: DwgEntityEditor;
    private drawing: Drawing;
    private context: Context;

    constructor(context: Context) {
        this.context = context;
        this.editor = context.cadview?.layer?.drawing?.layout.drawing?.layouts.model!.editor()!;
        this.drawing = context.cadview?.layer?.drawing?.layout.drawing!;
    }

    /** Создание модели пересечения двух 3D-моделей */
    public async createIntersectionModel(model1: DwgModel3d, model2: DwgModel3d): Promise<DwgModel3d> {
        const box1World: box3 = this.getWorldBoundingBox(model1);
        const box2World: box3 = this.getWorldBoundingBox(model2);
        const intersectionBoxWorld: box3 | undefined = this.computeIntersectionBox(box1World, box2World);

        if (!intersectionBoxWorld) {
            return this.createEmptyDwgModel3d();
        }

        const candidateTriangles1: MeshTriangle[] = this.getCandidateTriangles(model1, intersectionBoxWorld);
        const candidateTriangles2: MeshTriangle[] = this.getCandidateTriangles(model2, intersectionBoxWorld);

        const intersectionLines: { a: vec3; b: vec3 }[] = await this.computeTriangleIntersections(
            model1,
            model2,
            candidateTriangles1,
            candidateTriangles2
        );

        const intersectionGeometry: Geometry3d = this.createGeometryFromIntersectionLines(intersectionLines);

        this.editor.beginEdit();
        await this.drawGeometryTrianglesAsPolylines(this.editor, intersectionGeometry, 3);
        this.editor.endEdit();

        const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(intersectionGeometry);
        const newModel: DwgModel3d = await this.editor.addMesh({
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        const geometry: DwgGeometry3d = await this.drawing.geometries.add(uuidGeometry);
        await newModel.addMesh({ geometry });

        return newModel;
    }

    /** Получение мировой ограничивающей коробки модели */
    private getWorldBoundingBox(model: DwgModel3d): box3 {
        const localBounds: box3 = Object.values(model.meshes)[0]?.geometry?.bounds || [0, 0, 0, 0, 0, 0];
        return Math3d.box3.transformed(Math3d.box3.alloc(), localBounds, model.matrix);
    }

    /** Вычисление пересечения двух ограничивающих коробок */
    private computeIntersectionBox(box1: box3, box2: box3): box3 | undefined {
        const minX: number = Math.max(box1[0], box2[0]);
        const minY: number = Math.max(box1[1], box2[1]);
        const minZ: number = Math.max(box1[2], box2[2]);
        const maxX: number = Math.min(box1[3], box2[3]);
        const maxY: number = Math.min(box1[4], box2[4]);
        const maxZ: number = Math.min(box1[5], box2[5]);

        if (minX < maxX && minY < maxY && minZ < maxZ) {
            return [minX, minY, minZ, maxX, maxY, maxZ];
        }
        return undefined;
    }

    /** Получение кандидатных треугольников для пересечения */
    private getCandidateTriangles(model: DwgModel3d, intersectionBoxWorld: box3): MeshTriangle[] {
        const modelMatrixInverse: mat4 = Math3d.mat4.inverse(Math3d.mat4.alloc(), model.matrix);
        const intersectionBoxLocal: box3 = Math3d.box3.transformed(Math3d.box3.alloc(), intersectionBoxWorld, modelMatrixInverse);
        const candidates: MeshTriangle[] = [];

        for (const mesh of Object.values(model.meshes)) {
            const geometry: DwgGeometry3d | undefined = mesh.geometry;
            if (geometry && geometry.spatial) {
                const triangleIndices: number[] = this.getTrianglesInBox(geometry.spatial, intersectionBoxLocal);
                for (const triangleIndex of triangleIndices) {
                    candidates.push({ mesh, triangleIndex });
                }
            }
        }
        return candidates;
    }

    /** Получение индексов треугольников в заданной коробке */
    private getTrianglesInBox(spatial: SpatialIndex, box: box3): number[] {
        const triangles: number[] = [];
        spatial.walkBox(box, (triangleIndex: number) => {
            triangles.push(triangleIndex);
        });
        return triangles;
    }

    /** Вычисление линий пересечения между треугольниками */
    private async computeTriangleIntersections(
        model1: DwgModel3d,
        model2: DwgModel3d,
        triangles1: MeshTriangle[],
        triangles2: MeshTriangle[]
    ): Promise<{ a: vec3; b: vec3 }[]> {
        const intersectionLines: { a: vec3; b: vec3 }[] = [];
        const model1Matrix: mat4 = model1.matrix;
        const model2Matrix: mat4 = model2.matrix;

        for (const t1 of triangles1) {
            const { mesh: mesh1, triangleIndex: idx1 } = t1;
            const geo1: DwgGeometry3d | undefined = mesh1.geometry;
            const vertices1Local: [vec3, vec3, vec3] = this.getTriangleVertices(geo1, idx1);
            const vertices1World: [vec3, vec3, vec3] = [
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[0]),
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[1]),
                Math3d.mat4.mulv3([0, 0, 0], model1Matrix, vertices1Local[2]),
            ];

            for (const t2 of triangles2) {
                const { mesh: mesh2, triangleIndex: idx2 } = t2;
                const geo2: DwgGeometry3d | undefined = mesh2.geometry;
                const vertices2Local: [vec3, vec3, vec3] = this.getTriangleVertices(geo2, idx2);
                const vertices2World: [vec3, vec3, vec3] = [
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[0]),
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[1]),
                    Math3d.mat4.mulv3([0, 0, 0], model2Matrix, vertices2Local[2]),
                ];

                const intersection: { a: vec3; b: vec3 } | null = this.intersectTriangles(vertices1World, vertices2World);
                if (intersection) {
                    intersectionLines.push(intersection);
                }
            }
        }

        return intersectionLines;
    }

    /** Получение вершин треугольника из геометрии */
    private getTriangleVertices(geometry: DwgGeometry3d | undefined, triangleIndex: number): [vec3, vec3, vec3] {
        if (!geometry || !geometry.indices || !geometry.vertices) {
            return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        }
        const indices: Uint32Array = geometry.indices instanceof Uint32Array ? geometry.indices : new Uint32Array(geometry.indices);
        const vertices: Float32Array = geometry.vertices;

        const i0: number = indices[triangleIndex * 3];
        const i1: number = indices[triangleIndex * 3 + 1];
        const i2: number = indices[triangleIndex * 3 + 2];
        return [
            [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]],
            [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]],
            [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]],
        ];
    }

    /** Вычисление пересечения двух треугольников */
    private intersectTriangles(t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): { a: vec3; b: vec3 } | null {
        const plane1: { normal: vec3; d: number } = this.getPlaneFromTriangle(t1);
        const plane2: { normal: vec3; d: number } = this.getPlaneFromTriangle(t2);

        const intersections1: vec3[] = this.getIntersections(t2, plane1, t1);
        const intersections2: vec3[] = this.getIntersections(t1, plane2, t2);
        const allIntersections: vec3[] = this.removeDuplicatePoints([...intersections1, ...intersections2]);

        if (allIntersections.length < 2) {
            return null;
        }

        const { pointA, pointB } = this.findFurthestPoints(allIntersections);
        if (pointA && pointB && this.isValidIntersection(pointA, pointB, t1, t2)) {
            return { a: pointA, b: pointB };
        }
        return null;
    }

    /** Получение плоскости из треугольника */
    private getPlaneFromTriangle(t: [vec3, vec3, vec3]): { normal: vec3; d: number } {
        const v1: vec3 = Math3d.vec3.sub([0, 0, 0], t[1], t[0]);
        const v2: vec3 = Math3d.vec3.sub([0, 0, 0], t[2], t[0]);
        const crossProduct: vec3 = [0, 0, 0];
        Math3d.vec3.cross(crossProduct, v1, v2);
        const normal: vec3 = [0, 0, 0];
        Math3d.vec3.normalize(normal, crossProduct);
        const d: number = -Math3d.vec3.dot(normal, t[0]);
        return { normal, d };
    }

    private isPointInsideTriangle(p: vec3, t: [vec3, vec3, vec3]): boolean {
        const [a, b, c] = t;
    
        // Вычисляем v0 = b - a
        const v0: vec3 = [0, 0, 0];
        this.vec3Sub(v0, b, a);
    
        // Вычисляем v1 = c - a
        const v1: vec3 = [0, 0, 0];
        this.vec3Sub(v1, c, a);
    
        // Вычисляем v2 = p - a
        const v2: vec3 = [0, 0, 0];
        this.vec3Sub(v2, p, a);
    
        // Вычисляем скалярные произведения
        const dot00: number = Math3d.vec3.dot(v0, v0);
        const dot01: number = Math3d.vec3.dot(v0, v1);
        const dot02: number = Math3d.vec3.dot(v0, v2);
        const dot11: number = Math3d.vec3.dot(v1, v1);
        const dot12: number = Math3d.vec3.dot(v1, v2);
    
        // Вычисляем барицентрические координаты
        const invDenom: number = 1 / (dot00 * dot11 - dot01 * dot01);
        const u: number = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v: number = (dot00 * dot12 - dot01 * dot02) * invDenom;
    
        // Проверяем, находится ли точка внутри треугольника
        return u >= 0 && v >= 0 && u + v <= 1;
    }

    

    /** Получение точек пересечения треугольника с плоскостью */
    private getIntersections(triangle: [vec3, vec3, vec3], plane: { normal: vec3; d: number }, otherTriangle: [vec3, vec3, vec3]): vec3[] {
        const intersections: vec3[] = [];
        for (let i = 0; i < 3; i++) {
            const a: vec3 = triangle[i];
            const b: vec3 = triangle[(i + 1) % 3];
            const da: number = Math3d.vec3.dot(plane.normal, a) + plane.d;
            const db: number = Math3d.vec3.dot(plane.normal, b) + plane.d;
            if (da * db < 0) {
                const t: number = da / (da - db);
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

    /** Поиск двух наиболее удалённых точек */
    private findFurthestPoints(points: vec3[]): { pointA: vec3; pointB: vec3 } {
        let maxDist: number = 0;
        let pointA: vec3 | null = null;
        let pointB: vec3 | null = null;
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist: number = Math3d.vec3.distance(points[i], points[j]);
                if (dist > maxDist) {
                    maxDist = dist;
                    pointA = points[i];
                    pointB = points[j];
                }
            }
        }
        return { pointA: pointA!, pointB: pointB! };
    }

    /** Проверка валидности пересечения */
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

    /** Удаление дублирующихся точек */
    private removeDuplicatePoints(points: vec3[]) {
        const epsilon = 1e-6;
        return points.filter((p, i, arr) =>
            arr.findIndex(q => Math3d.vec3.distance(p, q) < epsilon) === i
        );
    }
    private vec3Sub(target: vec3, a: vec3, b: vec3): vec3 {
        const negB: vec3 = [0, 0, 0];        // Создаём массив для инвертированного вектора b
        Math3d.vec3.neg(negB, b);            // Инвертируем вектор b
        return Math3d.vec3.add(target, a, negB); // Складываем a с (-b) и записываем в target
    }

    /** Создание геометрии из линий пересечения */
    private createGeometryFromIntersectionLines(lines: { a: vec3; b: vec3 }[]): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex: number = 0;

        for (const line of lines) {
            vertices.push(line.a[0], line.a[1], line.a[2], line.b[0], line.b[1], line.b[2]);
            indices.push(vertexIndex, vertexIndex + 1);
            vertexIndex += 2;
        }

        const geometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length),
            indices: new Uint32Array(indices),
        };
        Math3d.geometry.calculateNormals(geometry);
        return geometry;
    }

    /** Отрисовка треугольников геометрии как полилиний (для отладки) */
    private async drawGeometryTrianglesAsPolylines(editor: DwgEntityEditor, geometry: Geometry3d, color: number): Promise<void> {
        const { vertices, indices } = geometry;

        if (indices.length % 3 !== 0) {
            console.error("Некорректное количество индексов в geometry.indices. Должно быть кратно 3.");
            return;
        }

        for (let i = 0; i < indices.length; i += 3) {
            const idx0: number = indices[i];
            const idx1: number = indices[i + 1];
            const idx2: number = indices[i + 2];

            const v0: vec3 = [vertices[idx0 * 3], vertices[idx0 * 3 + 1], vertices[idx0 * 3 + 2]];
            const v1: vec3 = [vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]];
            const v2: vec3 = [vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]];

            const polylineVertices: vec3[] = [v0, v1, v2, v0];

            for (let j = 0; j < polylineVertices.length - 1; j++) {
                const line: Partial<DwgLineData> = {
                    color,
                    a: polylineVertices[j],
                    b: polylineVertices[j + 1],
                };
                await editor.addLine(line);
            }
        }
    }

    /** Создание пустой 3D-модели */
    private async createEmptyDwgModel3d(): Promise<DwgModel3d> {
        const emptyGeometry: Geometry3d = {
            vertices: new Float32Array(),
            normals: new Float32Array(),
            indices: new Uint32Array(),
        };
        const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(emptyGeometry);
        const newModel: DwgModel3d = await this.editor.addMesh({
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        const geometry: DwgGeometry3d = await this.drawing.geometries.add(uuidGeometry);
        await newModel.addMesh({ geometry });
        return newModel;
    }
}