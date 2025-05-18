"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Fira_Code } from "next/font/google";

const firaCode = Fira_Code({ subsets: ["latin"] });

interface Project {
  id: string;
  name: string;
  gitRepoURL: string;
  subdomain: string;
  customDomain?: string;
}

interface Deployment {
  id: string;
  status: string;
  createdAt: string;
}

interface Analytics {
  totalRequests: number;
  requestsByPath: Record<string, number>;
  requestsByMethod: Record<string, number>;
}

export default function ProjectPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Project details
        const { data: projectData } = await api.get(`/projects/${id}`);
        setProject(projectData.project);

        // Deployments
        const { data: deploymentsData } = await api.get(`/deployments/${id}`);
        setDeployments(deploymentsData.deployments);

        // Fetch analytcs
        const { data: analyticsData } = await api.get(`/analytics/${id}`);
        setAnalytics(analyticsData.analytics);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    fetchData();
  }, [id]);

  const handleDeploy = async () => {
    try {
      const { data } = await api.post("/deploy", { projectId: id });
      setDeployments([{ ...data.data, status: "QUEUED" }, ...deployments]);
    } catch (error) {
      console.error("Deployment failed", error);
    }
  };

  const fetchLogs = async (deploymentId: string) => {
    setActiveDeployment(deploymentId);
    try {
      const { data } = await api.get(`/logs/${deploymentId}`);
      setLogs(data.logs.map((log: any) => log.log));
    } catch (error) {
      console.error("Failed to fetch logs", error);
    }
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-gray-600">{project.gitRepoURL}</p>
          <div className="mt-2">
            <p>
              Preview URL:{" "}
              <a
                href={`https://${project.subdomain}.${window.location.hostname}`}
                target="_blank"
                className="text-blue-500 hover:underline"
              >
                {project.subdomain}.{window.location.hostname}
              </a>
            </p>
            {project.customDomain && (
              <p>
                Custom Domain:{" "}
                <a
                  href={`https://${project.customDomain}.${window.location.hostname}`}
                  target="_blank"
                  className="text-blue-500 hover:underline"
                >
                  {project.customDomain}.{window.location.hostname}
                </a>
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleDeploy}>Deploy Now</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Analytics Section */}
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold">Analytics</h2>
          {analytics ? (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium">Total Requests</h3>
                <p className="text-3xl font-bold">{analytics.totalRequests}</p>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium mb-2">Requests by Path</h3>
                <ul className="space-y-1">
                  {Object.entries(analytics.requestsByPath).map(
                    ([path, count]) => (
                      <li key={path} className="flex justify-between">
                        <span className="text-gray-600">{path}</span>
                        <span className="font-medium">{count}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="font-medium mb-2">Requests by Method</h3>
                <ul className="space-y-1">
                  {Object.entries(analytics.requestsByMethod).map(
                    ([method, count]) => (
                      <li key={method} className="flex justify-between">
                        <span className="text-gray-600">{method}</span>
                        <span className="font-medium">{count}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p>No analytics data available</p>
          )}
        </div>

        {/* Deployments and Logs Section */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Deployments</h2>
            <div className="space-y-2">
              {deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className={`p-4 rounded-lg border cursor-pointer ${
                    activeDeployment === deployment.id
                      ? "bg-gray-50 border-blue-500"
                      : "bg-white"
                  }`}
                  onClick={() => fetchLogs(deployment.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {new Date(deployment.createdAt).toLocaleString()}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        deployment.status === "DEPLOYED"
                          ? "bg-green-100 text-green-800"
                          : deployment.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {deployment.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Deployment Logs</h2>
            {logs.length > 0 ? (
              <div
                className={`${firaCode.className} bg-black text-green-400 p-4 rounded-lg overflow-auto max-h-96`}
              >
                <pre className="whitespace-pre-wrap">
                  {logs.map((log, i) => (
                    <code key={i} className="block mb-1">
                      {log}
                    </code>
                  ))}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-100 p-4 rounded-lg text-gray-600">
                {activeDeployment
                  ? "Loading logs..."
                  : "Select a deployment to view logs"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
