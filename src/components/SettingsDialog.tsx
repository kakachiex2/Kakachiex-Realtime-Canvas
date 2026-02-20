import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { Circle } from "lucide-react"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (host: string) => void
  status: string
}

export function SettingsDialog({ open, onOpenChange, onConnect, status }: SettingsDialogProps) {
  // Persistent Storage
  const [storedHost, setStoredHost] = useLocalStorage("comfy-host", "http://127.0.0.1:8188")
  const [storedWorkflow, setStoredWorkflow] = useLocalStorage("comfy-workflow", "{}")
  const [storedWorkflowName, setStoredWorkflowName] = useLocalStorage("comfy-workflow-name", "")

  // Local form state
  const [host, setHost] = useState(storedHost)
  const [workflow, setWorkflow] = useState(storedWorkflow)
  const [workflows, setWorkflows] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>(storedWorkflowName)

  // Sync from storage when dialog opens
  useEffect(() => {
    if (open) {
      setHost(storedHost)
      setWorkflow(storedWorkflow)
      setSelectedFile(storedWorkflowName)
      
      // Fetch workflows
      fetch('/api/workflows')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                setWorkflows(data);
            }
        })
        .catch(err => console.error("Failed to fetch workflows", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  
  const handleConnect = () => {
    setStoredHost(host)
    setStoredWorkflow(workflow)
    if (selectedFile) setStoredWorkflowName(selectedFile)
    onConnect(host)
    // Do NOT close dialog
  }

  const handleSave = () => {
    setStoredHost(host)
    setStoredWorkflow(workflow)
    if (selectedFile) setStoredWorkflowName(selectedFile)
    onOpenChange(false)
  }
  
  const handleWorkflowSelect = async (filename: string) => {
      setSelectedFile(filename);
      try {
          const res = await fetch(`/api/workflows/${filename}`);
          if (res.ok) {
              const json = await res.json();
              setWorkflow(JSON.stringify(json, null, 2));
          }
      } catch (e) {
          console.error("Failed to load workflow", e);
      }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'CONNECTED': return 'text-green-500 fill-green-500';
      case 'CONNECTING': return 'text-yellow-500 fill-yellow-500';
      case 'ERROR': return 'text-red-500 fill-red-500';
      default: return 'text-gray-400 fill-gray-400';
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>ComfyUI Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          
          {/* Status Indicator */}
          <div className="flex items-center justify-center gap-2 pb-2">
             <Circle className={`h-3 w-3 ${getStatusColor()}`} />
             <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{status}</span>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="host" className="text-right">
              Host
            </Label>
            <Input
              id="host"
              value={host}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHost(e.target.value)}
              className="col-span-3"
              placeholder="http://127.0.0.1:8188"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Select</Label>
            <div className="col-span-3">
                <Select value={selectedFile} onValueChange={handleWorkflowSelect}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a workflow..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="workflow" className="text-right pt-2">
              JSON
            </Label>
            <textarea
              id="workflow"
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              className="col-span-3 flex min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="{ ... }"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSave}>Save</Button>
          <Button onClick={handleConnect}>Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
