export class Interceptor{
    public intersect(poly1: vec3[][], poly2: vec3[][]): vec3[][] {
        const resultTriangles: vec3[][] = [];
        /*

        const targetA: vec3 = [0, 0, 0];
        const targetB: vec3 = [0, 0, 0];
        const plane: plane3 = [0, 0, 0, 0];

        for (const tri1 of poly1) {
            for (const tri2 of poly2) {
                Math3d.plane3.make3pt(plane, tri1[0], tri1[1], tri1[2]);
                
                const ray: ray3 = [0, 0, 0, 0, 0, 0];
                const intersectionPoints: vec3[] = [];

                for (let i = 0; i < 3; i++) {
                    const start = tri2[i];
                    const end = tri2[(i + 1) % 3];
                    
                    Math3d.ray3.make(ray, start, 
                        Math3d.vec3.sub(targetA, end, start));
                    
                    const intersectPoint = Math3d.plane3.intersectRay(targetB, plane, ray);
                    if (intersectPoint && this.isPointInTriangle(intersectPoint, tri1)) {
                        intersectionPoints.push([...intersectPoint]);
                    }
                }
                
               
            }
        }*/
        return resultTriangles;
       
    }


    private isPointInTriangle(point: vec3, triangle: vec3[]): boolean {
        const v0 = Math3d.vec3.sub([0, 0, 0], triangle[2], triangle[0]);
        const v1 = Math3d.vec3.sub([0, 0, 0], triangle[1], triangle[0]);
        const v2 = Math3d.vec3.sub([0, 0, 0], point, triangle[0]);

        const dot00 = Math3d.vec3.dot(v0, v0);
        const dot01 = Math3d.vec3.dot(v0, v1);
        const dot02 = Math3d.vec3.dot(v0, v2);
        const dot11 = Math3d.vec3.dot(v1, v1);
        const dot12 = Math3d.vec3.dot(v1, v2);

        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return (u >= 0) && (v >= 0) && (u + v <= 1);
    }
}