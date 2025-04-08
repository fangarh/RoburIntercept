type MeshTriangle = { mesh: DwgMesh; triangleIndex: number };

export class IntersectionFinder3 {
    private context: Context;
    private editor: DwgEntityEditor;
    private drawing: Drawing;

    constructor(context: Context) {
        this.context = context;
        this.editor = context.cadview?.layer?.drawing?.layout.drawing?.layouts.model!.editor()!;
        this.drawing = context.cadview?.layer?.drawing?.layout.drawing!;
    }

    public async findIntersection(model1: DwgModel3d, model2: DwgModel3d): Promise<boolean> {
        const box1World: box3 | undefined = this.getWorldBoundingBox(model1);

        if(!box1World) return false;

        const box2World: box3 | undefined = this.getWorldBoundingBox(model2);

        if(!box2World) return false;

        const intersectionBoxWorld: box3 | undefined = this.computeIntersectionBox(box1World, box2World);

        if (!intersectionBoxWorld)  return false;

        const candidateTriangles1: MeshTriangle[] = this.getCandidateTriangles(model1, intersectionBoxWorld);
        const candidateTriangles2: MeshTriangle[] = this.getCandidateTriangles(model2, intersectionBoxWorld);

        const intersectionLines: { a: vec3; b: vec3 }[] = await this.computeTriangleIntersections(
            model1,
            model2,
            candidateTriangles1,
            candidateTriangles2
        );        
        
        if(intersectionLines.length == 0)
            return false;

      //  const intersectionGeometry: Geometry3d = this.createGeometryFromIntersectionLines(intersectionLines);
      //  const uuidGeometry: UuidGeometry3d = await Math3d.geometry.createUuidGeometry3d(intersectionGeometry);
      //  this.addAnnotation(intersectionLines, uuidGeometry, model1.layer?.getx("name") + "\n " + model2.layer?.getx("name") )

        return true;
    }

    private getWorldBoundingBox(model: DwgModel3d): box3 | undefined{
        const box: box3 = Math3d.box3.alloc();
        let initialized: boolean = false;

        if(model.meshes == undefined){
            return undefined;  
        }

        for (const mesh of Object.values(model.meshes)) {
            const geometry: DwgGeometry3d | undefined = mesh.geometry;
            if (geometry) {
                const localBounds: box3 = geometry.bounds;
                const worldBounds: box3 = Math3d.box3.transformed(Math3d.box3.alloc(), localBounds, model.matrix);

                if (!initialized) {
                    Math3d.box3.dup(box, worldBounds);
                    initialized = true;
                } else {
                    Math3d.box3.addBox(box, worldBounds);
                }
            }
        }

        if (!initialized) {
            return undefined;  
        }
        return box;
    }

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

    private getTrianglesInBox(spatial: SpatialIndex, box: box3): number[] {
        const triangles: number[] = [];
        spatial.walkBox(box, (triangleIndex: number) => {
            triangles.push(triangleIndex);
        });
        return triangles;
    }

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

    private getTriangleVertices(geometry: DwgGeometry3d | undefined, triangleIndex: number): [vec3, vec3, vec3] {
        if (!geometry || !geometry.indices || !geometry.vertices) {
            return [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        }
    
        const vertices: Float32Array = geometry.vertices;
    
        const i0: number = geometry.indices[triangleIndex * 3];
        const i1: number = geometry.indices[triangleIndex * 3 + 1];
        const i2: number = geometry.indices[triangleIndex * 3 + 2];    

        return [
            [vertices[i0 * 3], vertices[i0 * 3 + 1], vertices[i0 * 3 + 2]],
            [vertices[i1 * 3], vertices[i1 * 3 + 1], vertices[i1 * 3 + 2]],
            [vertices[i2 * 3], vertices[i2 * 3 + 1], vertices[i2 * 3 + 2]],
        ];
    }


    private intersectTriangles(t1: [vec3, vec3, vec3], t2: [vec3, vec3, vec3]): { a: vec3; b: vec3 } | null {
        var plane1 : plane3 = Math3d.plane3.make3pt(Math3d.plane3.alloc(), t1[0], t1[1], t1[2]); 
        var plane2 : plane3 = Math3d.plane3.make3pt(Math3d.plane3.alloc(), t2[0], t2[1], t2[2]); 

        const intersections1: vec3[] = this.getIntersections(t2, plane1, t1);
        const intersections2: vec3[] = this.getIntersections(t1, plane2, t2);
        const allIntersections: vec3[] = this.removeDuplicatePoints(intersections1.concat(intersections2));

        if (allIntersections.length < 2) {
            return null;
        }

        const { pointA, pointB } = this.findFurthestPoints(allIntersections);
        if (pointA && pointB && this.isValidIntersection(pointA, pointB, t1, t2)) {
            return { a: pointA, b: pointB };
        }

        return null;
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

    private removeDuplicatePoints(points: vec3[]): vec3[] {
          const epsilon: number = 1e-6;
          return points.filter((p, i, arr) =>
              arr.findIndex(q => Math3d.vec3.distance(p, q) < epsilon) === i
          );
          return points;
      }

    private getIntersections(triangle: [vec3, vec3, vec3], plane: plane3, otherTriangle: [vec3, vec3, vec3]): vec3[] {
        const intersections: vec3[] = [];
        for (let i = 0; i < 3; i++) {
            const a: vec3 = triangle[i];
            const b: vec3 = triangle[(i + 1) % 3];
            const da: number = Math3d.vec3.dot([plane[0], plane[1], plane[2]], a) + plane[3];
            const db: number = Math3d.vec3.dot([plane[0], plane[1], plane[2]], b) + plane[3];
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

    private isPointInsideTriangle(p: vec3, t: [vec3, vec3, vec3]): boolean {
        const [a, b, c] = t;
        const v0: vec3 = Math3d.vec3.sub([0, 0, 0], b, a);
        const v1: vec3 = Math3d.vec3.sub([0, 0, 0], c, a);
        const v2: vec3 = Math3d.vec3.sub([0, 0, 0], p, a);
        const dot00: number = Math3d.vec3.dot(v0, v0);
        const dot01: number = Math3d.vec3.dot(v0, v1);
        const dot02: number = Math3d.vec3.dot(v0, v2);
        const dot11: number = Math3d.vec3.dot(v1, v1);
        const dot12: number = Math3d.vec3.dot(v1, v2);
        const invDenom: number = 1 / (dot00 * dot11 - dot01 * dot01);
        const u: number = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v: number = (dot00 * dot12 - dot01 * dot02) * invDenom;
        return u >= 0 && v >= 0 && u + v <= 1;
    }

    private addAnnotation(intersectionLines: { a: vec3; b: vec3 }[], uuidGeometry: UuidGeometry3d, text: string){
        if (intersectionLines.length > 0 && uuidGeometry.bounds) {
            const box: box3 = uuidGeometry.bounds; 
            const center: vec3 = [0, 0, 0];
            Math3d.box3.center(center, box); 

            const annotation: AnnotationInit<AnnotationSimple> = {
                type: 'simple',
                position: center,
                text: text ,
                attachment: 'center', 
            };

            const layer = this.context.cadview?.annotations.standard!; 
            layer.add(annotation);
            this.context.cadview?.invalidate(); 
            
        }
    }

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
}