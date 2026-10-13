# API reference  (Base: /api · All routes except /auth/login need Authorization: Bearer <JWT>)

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | /auth/login | public | {email,password} → {token,user} |
| GET | /auth/me | all | current profile |
| GET | /patients | all | page,pageSize,search,hospitalId,condition,severity,status,from,to,sort,dir |
| GET | /patients/conditions | all | |
| GET /POST /PUT /DELETE | /patients[/:id] | admin,staff / admin | |
| GET | /hospitals[/:id] | all | |
| POST /PUT | /hospitals[/:id] | admin | |
| GET | /analytics/overview|admissions|diseases|hospitals | all | hospitalIds,from,to |
| GET | /warehouse/schema | admin,analyst | |
| GET | /warehouse/status | admin,analyst | |
| POST | /warehouse/etl/run | admin | |
| GET | /olap/meta | admin,analyst | |
| POST | /olap/query | admin,analyst | {rows[],columns[],measure,filters[]} |
| POST | /mining/kmeans | admin,analyst | {features[],k,standardize,hospitalIds?} |
| POST | /mining/dbscan | admin,analyst | {features[],eps,minPts,hospitalIds?} |
| POST | /mining/decision-tree | admin,analyst | {target,features[],maxDepth,testSize} |
| POST | /mining/random-forest | admin,analyst | {target,features[],nTrees,maxDepth,testSize} |
| POST | /mining/naive-bayes | admin,analyst | {target,features[],testSize} |
| POST | /mining/linear-regression | admin,analyst | {target,features[],testSize} |
| POST | /mining/apriori | admin,analyst | {source,minSupport,minConfidence,minLift} |
| POST | /mining/cross-hospital | admin,analyst | {features[],k} |
| POST | /mining/compare | admin,analyst | {target,features[],testSize} |
| POST | /reports/generate | all | {title,hospitalIds[],from,to,includeMining,includeApriori} |
| GET | /quality | admin,analyst | |
| GET | /quality/records/:key | admin,analyst | |
