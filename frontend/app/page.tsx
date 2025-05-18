"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from "lucide-react";

interface Project {
  id: string;
  name: string;
  subdomain: string;
  gitRepoURL: string;
}

export default function Home() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProject, setNewProject] = useState({ name: "", repoURL: "" });

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data.projects);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    }
  }, []);

  const createProject = async () => {
    try {
      await api.post("/project", {
        name: newProject.name,
        gitRepoURL: newProject.repoURL,
      });
      fetchProjects();
      setNewProject({ name: "", repoURL: "" });
    } catch (error) {
      console.error("Project creation failed", error);
    }
  };

  useEffect(() => {
    if (!token) router.push("/login");
    fetchProjects();
  }, [token, router, fetchProjects]);

  return (
    <div className="grid grid-cols-3 gap-8">
      {/* Projects List */}
      <div className="col-span-1">
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">Create New Project</h2>
          <Input
            placeholder="Project Name"
            value={newProject.name}
            onChange={(e) =>
              setNewProject({ ...newProject, name: e.target.value })
            }
          />
          <div className="flex items-center gap-2 mt-2">
            <Github className="text-gray-500" />
            <Input
              placeholder="GitHub URL"
              value={newProject.repoURL}
              onChange={(e) =>
                setNewProject({ ...newProject, repoURL: e.target.value })
              }
            />
          </div>
          <Button className="mt-2 w-full" onClick={createProject}>
            Create Project
          </Button>
        </div>

        <h2 className="text-xl font-bold mb-2">Your Projects</h2>
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-4 mb-2 border rounded cursor-pointer hover:bg-gray-50"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <h3 className="font-semibold">{project.name}</h3>
            <p className="text-sm text-gray-600">{project.gitRepoURL}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
