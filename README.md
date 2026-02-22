# FlightPlan UI
## Table of Contents
- [1. Solution Overview](#1-solution-overview)
  - [1.1 Tech Stack](#11-tech-stack)
  - [1.2 High-Level Data Flow System Diagram](#12-high-level-data-flow-system-diagram)
  - [1.3 AWS Infrastructure](#13-aws-infrastructure)
  - [1.4 CI/CD](#14-cicd)
- [2. Frontend Client](#2-frontend-client)
  - [2.1 Code Structure](#21-code-structure)
  - [2.2 Key Concepts](#22-key-concepts)
  - [2.3 Setup & Run](#23-setup--run)

## 1. Solution Overview

### 1.1 Tech Stack

#### Frontend
- React (Vite)
- Repository: https://github.com/ST-tienhon/flightplan-ui

#### Backend
- NodeJS
- Repository: https://github.com/ST-tienhon/flightplan-server

#### Containerization
- Docker

#### Cloud Infrastructure (Amazon Web Services)
- Virtual Private Cloud (VPC)
- Application Load Balancer (ALB)
- Elastic Container Services Fargate (ECS)
- Elastic Container Registry (ECR)
- Identity and Access Management (IAM)


### 1.2 High-Level Data Flow System Diagram
```mermaid
sequenceDiagram
    participant A as Client <br/> (FlightPlan-UI)
    participant B as Server <br/> (FlightPlan-Server)
    participant C as External Service <br/> (ClientSwimAPI)
    A->>B: GET /api/flights <br/> GET /api/flightDetails
    activate B
    B->>C: GET /flight-manager/displayAll <br/> GET /geopoints/list
    note left of B: Business logic
    C-->>B: JSON response
    B-->>A: Processed JSON response
    deactivate B
```

### 1.3 AWS Infrastructure
- Virtual Private Cloud (VPC)
  - Subnets for ALB and Fargate services to run in
  - Availability Zones
  - Security groups for traffic to ALB and Task
- Application Load Balancer (ALB)
  - Listeners that routes data to target groups to Fargate services
- Elastic Container Services - Fargate (ECS)
  - Container services that runs dockerized application
- Elastic Container Registry (ECR)
  - Holds docker images
- Identity and Access Management (IAM)
  - Configuration for pushing to ECR and updating to ECS

```mermaid
architecture-beta
    group vpc(cloud)[VPC]

    %% AZ 1 Layout
    group az1(cloud)[AZ 1] in vpc
    group subnet1(cloud)[Public Subnet A] in az1
    service web1(server)[Web Client A] in subnet1
    service alb_n1(server)[ALB Node A] in subnet1
    service backend1(server)[Backend API A] in subnet1

    %% AZ 2 Layout
    group az2(cloud)[AZ 2] in vpc
    group subnet2(cloud)[Public Subnet B] in az2
    service web2(server)[Web Client B] in subnet2
    service alb_n2(server)[ALB Node B] in subnet2
    service backend2(server)[Backend API B] in subnet2

    %% Regional Logic
    service internet(internet)[Internet]
    junction alb_distributor

    %% Initial Entry
   internet:B -- T:alb_distributor
   alb_distributor:R -- L:alb_n1
   alb_distributor:B -- T:alb_n2

    %% Traffic: ALB to Web
    %%alb_n1:T -- B:web1
    %%alb_n2:T -- B:web2

    %% Traffic: Web to ALB (API calls)
    web1:L -- R:alb_n1
    web2:L -- R:alb_n2

    %% Traffic: ALB to Backend
    alb_n1:B -- T:backend1
    alb_n2:B -- T:backend2
```
Enhancement:
- Route53 + ACM
- 2x Private Subnet
- NAT Gateway

### 1.4 CI/CD
- Github Actions
  1. Push code into Github repository
  2. Run automated tests
  3. Build Docker image
  4. Push image to ECR
  5. Create new task definition in ECS
  6. Update service to new task definition


## 2. Frontend Client

### 2.1 Code Structure
```
/flightplan-ui
├─ .github/workflows/
│  └─ ci.yml                         # Github Actions
│
├─ src/
│  ├─ App.css
│  ├─ App.jsx                        # Main client application
│  ├─ index.css
│  ├─ main.jsx
│  └─ styles.css                     # Main stylesheet for App.jsx
│  
├─ .dockerignore
├─ .gitignore
├─ Dockerfile
├─ README.md
├─ eslint.config.js
├─ index.html
├─ nginx.conf                        # nginx config file for nginx docker image
├─ package-lock.json
├─ package.json
└─ vite.config.js
```
### 2.2 Key Concepts
#### 2.2.1 API for functional frontend
| Method | Endpoint               | Description                       |
| ------ | ---------------------- | --------------------------------- |
| GET    | /api/flights           | Summarized list of all flights    |
| GET    | /api/flightDetails?id= | Flight details of selected flight |

#### 2.2.2 Flights Panel
```mermaid
sequenceDiagram
    participant A as Client <br/> (FlightPlan-UI)
    participant B as Server <br/> (FlightPlan-Server)
    A->>B: GET /api/flights
    B-->>A: JSON response [{id, callsign, departure, arrival}]
    activate A
    note left of A: Displaying summarized fields
    deactivate A
```

#### 2.2.3 Flight Details Panel
```mermaid
---
config:
    sequence:
        noteAlign: left
---
sequenceDiagram
    participant A as Client <br/> (FlightPlan-UI)
    participant B as Server <br/> (FlightPlan-Server)
    A->>B: GET /api/flightDetails?id=
    B-->>A: JSON response [{callsign, dep, arr, routeText, waypoints, legs}]
    activate A
    note left of A: Display flight details <br/> Build PathsData with waypoints <br/> Build LabelsData with waypoints and legs
    deactivate A
```

#### 2.2.4 Flight Path Panel
Main component for visualization of airway route on a globe `globe.gl`.  
Repository: https://github.com/vasturiano/globe.gl  

Populate globe.gl properties with PathsData and LabelsData. Airway routes with labels will be drawn.  
Enhancing UI/UX by:
- Animated path for direction of flight.
- Added colours for Arrival and Departure airports.
- Center the path for convenience.


### 2.3 Setup & Run

#### Local Development
##### System Requirements
-Ubuntu 24.04

##### Update System
```bash
sudo apt update
sudo apt upgrade -y
```

##### Install Node version manager (NVM), Node.js
```bash
sudo apt install curl build-essential -y
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
nvm install 24
```

##### Local Environment
```bash
git clone https://github.com/ST-tienhon/flightplan-ui.git
cd flightplan-ui
```

##### Running Application (development)
```bash
npm install
npm run dev
```
Points to `http://localhost:3000` for backend as specified in `vite.config.js`.

##### Docker Run
```bash
docker build -t client .
docker run -d -p 80:80 client:latest
```
For running docker locally, consider running both backend and frontend concurrently via docker compose.