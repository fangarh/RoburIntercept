type MeshTriangle = { mesh: DwgMesh; triangleIndex: number };

export class IntersectionFinder {
    private context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Создает DwgModel3d, представляющий пересечение двух моделей.
     * @param model1 Первая модель DwgModel3d.
     * @param model2 Вторая модель DwgModel3d.
     * @returns Промис, разрешающийся в новую модель DwgModel3d с пересечением.
     */
    public async createIntersectionModel(model1: DwgModel3d, model2: DwgModel3d): Promise<DwgModel3d> {
        const box1World = this.getWorldBoundingBox(model1);
        const box2World = this.getWorldBoundingBox(model2);

        const intersectionBoxWorld = this.computeIntersectionBox(box1World, box2World);
        if (!intersectionBoxWorld) {
            return this.createEmptyDwgModel3d();
        }

        const candidateTriangles1 = this.getCandidateTriangles(model1, intersectionBoxWorld);
        const candidateTriangles2 = this.getCandidateTriangles(model2, intersectionBoxWorld);

        const selectedFromModel1 = this.selectTrianglesInsideModel(model1, model2, candidateTriangles1);
        const selectedFromModel2 = this.selectTrianglesInsideModel(model2, model1, candidateTriangles2);
        const selectedTriangles = selectedFromModel1.concat(selectedFromModel2);

        const newGeometry = this.createGeometryFromMeshTriangles(selectedTriangles);
        const uuidGeometry = await Math3d.geometry.createUuidGeometry3d(newGeometry);

        const newModel = await this.context.addEntity('DwgModel3d', {
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        await newModel.addMesh({ geometry: uuidGeometry });
        return newModel;
    }

    /**
     * Вычисляет ограничивающий параллелепипед модели в мировых координатах.
     * @param model Модель для вычисления.
     * @returns Ограничивающий параллелепипед в мировом пространстве.
     */
    private getWorldBoundingBox(model: DwgModel3d): box3 {
        const localBounds = Object.values(model.meshes)[0]?.geometry?.bounds || [0, 0, 0, 0, 0, 0];
        return Math3d.box3.transformed(Math3d.box3.alloc(), localBounds, model.matrix);
    }

    /**
     * Вычисляет пересечение двух ограничивающих параллелепипедов.
     * @param box1 Первый параллелепипед.
     * @param box2 Второй параллелепипед.
     * @returns Пересекающийся параллелепипед или undefined, если пересечения нет.
     */
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

    /**
     * Получает кандидатные треугольники из модели в пределах заданного мирового параллелепипеда.
     * @param model Модель для извлечения треугольников.
     * @param intersectionBoxWorld Мировой параллелепипед пересечения.
     * @returns Массив кандидатных треугольников с их мешем и индексом.
     */
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

    /**
     * Собирает индексы треугольников, пересекающих заданный box, из SpatialIndex.
     * @param spatial Пространственный индекс.
     * @param box Ограничивающий параллелепипед в локальных координатах.
     * @returns Массив индексов треугольников.
     */
    private getTrianglesInBox(spatial: any, box: box3): number[] {
        const triangles: number[] = [];
        spatial.walkBox(box, (triangleIndex: number) => {
            triangles.push(triangleIndex);
        });
        return triangles;
    }

    /**
     * Выбирает треугольники из кандидатов, полностью находящиеся внутри другой модели.
     * @param model Модель, содержащая треугольники.
     * @param otherModel Модель для проверки.
     * @param candidateTriangles Кандидатные треугольники.
     * @returns Массив выбранных треугольников как MeshTriangle.
     */
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

    /**
     * Проверяет, находится ли точка в мировых координатах внутри модели.
     * @param model Модель для проверки.
     * @param pointWorld Точка в мировых координатах.
     * @returns True, если точка внутри модели, иначе false.
     */
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

    /**
     * Определяет, находится ли точка внутри геометрии, используя метод трассировки лучей.
     * @param geometry Геометрия для проверки.
     * @param pointLocal Точка в локальных координатах геометрии.
     * @returns True, если точка внутри геометрии, иначе false.
     */
    private isPointInsideGeometry(geometry: DwgGeometry3d, pointLocal: vec3): boolean {
        const rayDirection: vec3 = [1, 0, 0]; // Произвольное направление вдоль оси X
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
        return intersections.length % 2 === 1;
    }

    /**
     * Извлекает вершины треугольника из геометрии по его индексу.
     * @param geometry Геометрия, содержащая данные треугольника.
     * @param triangleIndex Индекс треугольника в массиве индексов геометрии.
     * @returns Вершины треугольника в локальных координатах.
     */
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

    /**
     * Создает новую геометрию из массива MeshTriangle.
     * @param meshTriangles Массив треугольников, представленных как MeshTriangle.
     * @returns Новая геометрия Geometry3d.
     */
    private createGeometryFromMeshTriangles(meshTriangles: MeshTriangle[]): Geometry3d {
        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexIndex = 0;
    
        // Заполняем массивы вершин и индексов
        for (const { mesh, triangleIndex } of meshTriangles) {
            const geometry = mesh.geometry;
            const triangleVertices = this.getTriangleVertices(geometry, triangleIndex);
            const vec: vec3 = [0, 0, 0];
            const worldVertices = triangleVertices.map(v => Math3d.mat4.mulv3(vec, mesh.model.matrix, v));
            for (const v of worldVertices) {
                vertices.push(...v);
                indices.push(vertexIndex++);
            }
        }
    
        // Создаем объект Geometry3d с обязательным полем normals
        const newGeometry: Geometry3d = {
            vertices: new Float32Array(vertices),
            normals: new Float32Array(vertices.length), // Изначально пустой массив нужного размера
            indices: new Uint32Array(indices),
        };
    
        // Вычисляем нормали
        Math3d.geometry.calculateNormals(newGeometry);
    
        return newGeometry;
    }

    /**
     * Создает пустую модель DwgModel3d для случаев, когда пересечение отсутствует.
     * @returns Промис, разрешающийся в пустую модель DwgModel3d.
     */
    private async createEmptyDwgModel3d(): Promise<DwgModel3d> {
        const emptyGeometry: Geometry3d = {
            vertices: new Float32Array(),
            normals: new Float32Array(),
            indices: new Uint32Array(),
        };
        const uuidGeometry = await Math3d.geometry.createUuidGeometry3d(emptyGeometry);
        const newModel = await this.context.addEntity('DwgModel3d', {
            position: [0, 0, 0],
            rotation: 0,
            scale: [1, 1, 1],
            normal: [0, 0, 1],
        });
        await newModel.addMesh({ geometry: uuidGeometry });
        return newModel;
    }
}