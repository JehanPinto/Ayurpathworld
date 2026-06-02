import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  HeartPulse,
  Leaf,
  ShieldCheck,
  Globe2,
  UploadCloud,
  CheckSquare,
  X,
  FileText,
  Loader2,
  Briefcase,
  ArrowUpRight,
  ArrowUp
} from "lucide-react";

import { PublicLayout } from "@/components/layout/public-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { JobCard } from "@/components/ui/job-card";
import { ValueCard } from "@/components/ui/value-card";
import { useToast } from "@/hooks/use-toast";
import LightcareerImage from "@/assets/image/career image.png";
import DarkcareerImage from "@/assets/image/career dark mode.png";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { LoadingPage } from "@/components/ui/loading-spinner";

interface Career {
  id: string;
  careerTitle: string;
  location: string;
  employmentType: string;
  salaryRange?: string;
  description?: string;
  keyResponsibilities?: string;
  requiredQualifications?: string;
  benefits?: string;
  isActive: boolean;
}

const valuesData = [
  {
    icon: HeartPulse,
    title: "Patient-Centered Care",
    description: "We prioritize the well-being of every patient, ensuring personalized treatment plans that address individual health needs."
  },
  {
    icon: Leaf,
    title: "Holistic Approach",
    description: "We preserve and promote the ancient knowledge of Ayurveda, passed down through generations of Sri Lankan healers."
  },
  {
    icon: ShieldCheck,
    title: "Verified Professionals",
    description: "All doctors on our platform are verified professionals with proper certifications and credentials."
  },
  {
    icon: Globe2,
    title: "Preventive Focus",
    description: "Making quality Ayurvedic healthcare accessible to everyone, anywhere in Sri Lanka through online consultations."
  }
];

const applySchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
});

type ApplyInput = z.infer<typeof applySchema>;

export default function CareersPage() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const { data: dbCareers = [], isLoading, isPending, isError } = useQuery<Career[]>({
    queryKey: ["/api/careers"],
  });

  const activeJobs = dbCareers.filter(career => career.isActive);
  const [viewingJob, setViewingJob] = useState<Career | null>(null);
  const [selectedJob, setSelectedJob] = useState<Career | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const showEmptyState = (!isLoading && !isPending) && (isError || activeJobs.length === 0);


  const form = useForm<ApplyInput>({
    resolver: zodResolver(applySchema),
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = async (data: ApplyInput) => {
    if (!uploadedFile) {
      toast({ title: "CV Required", description: "Please upload your CV before submitting.", variant: "destructive" });
      return;
    }
    if (!selectedJob) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("jobId", selectedJob.id);
      formData.append("jobTitle", selectedJob.careerTitle);
      formData.append("fullName", data.name);
      formData.append("email", data.email);
      formData.append("cv", uploadedFile);

      const response = await fetch("/api/careers/apply", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Submission failed");

      toast({
        title: "Application Submitted! 🎉",
        description: "We have received your application. Our talent team will contact you soon."
      });

      setSelectedJob(null);
      removeFile();
      form.reset();
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Something went wrong while submitting your application. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle File Selection & Create Preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Handle File Selection & Create Preview
  const removeFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUploadedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Cleanup preview URL on unmount or when a new file is selected
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (isLoading || isPending) {
    return (
      <PublicLayout>
        <LoadingPage message="Loading careers..." />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

        <div className="container mx-auto px-3 pt-4 relative">

          {/* =========================================
              EMPTY STATE (No Vacancies)
              ========================================= */}
          {showEmptyState && !selectedJob && !viewingJob && (
            <div className="max-w-4xl mx-auto mt-8 mb-20 flex flex-col items-center justify-center text-center">
              <img
                src={LightcareerImage}
                alt="No jobs available"
                className="mb-8 object-contain dark:hidden"
              />
              <img
                src={DarkcareerImage}
                alt="No jobs available"
                className="mb-8 object-contain dark:block hidden"
              />
              <h1 className="lg:text-[56px] md:text-[48px] sm:text-[40px] text-[32px] font-bold text-foreground mb-8 tracking-tight">
                No Open Positions Right Now.
              </h1>
              <p className="lg:text-[20px] md:text-[18px] sm:text-[16px] text-[14px] text-black dark:text-muted-foreground">
                We're not hiring at the moment, but we're always looking for talent.
              </p>
            </div>
          )}

          {/* =========================================
              JOB LISTINGS (Grid)
              ========================================= */}
          {activeJobs.length > 0 && !selectedJob && (
            <>
              {/* Hero & Jobs Section */}
              <div className="max-w-7xl mx-auto pt-4">
                <div className="text-center max-w-3xl mx-auto">
                  <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-1">Join Our Team</h1>
                  <p className="text-lg text-[#111815] dark:text-muted-foreground">
                    Ready to take the next step in your career? Join a team that values innovation, collaboration, and growth. Explore our open positions and find where you fit best in our mission to shape the future.
                  </p>
                  <h2 className="text-xl font-bold text-foreground mt-7">Open Roles</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                  {activeJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      id={job.id}
                      title={job.careerTitle}
                      subtitle="AyurPath Wellness Center"
                      type={job.employmentType}
                      location={job.location}
                      salaryRange={job.salaryRange ?? ""}
                      department={job.description?.substring(0, 30) + "..."}
                      icon={Briefcase}
                      onSeeMore={() => setViewingJob(job)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </section>

      {/* =========================================
          OUR VALUES SECTION
          ========================================= */}
      {activeJobs.length > 0 && !selectedJob && (
        <section className="bg-[#E1ECE3] mt-14 pt-14 pb-14 dark:bg-card">
          <div className="container mx-auto px-4">

            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-0">Our Values</h2>
              <p className="text-[#111815] dark:text-muted-foreground">The principles that guide everything we do</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {valuesData.map((value, index) => (
                <ValueCard
                  key={index}
                  icon={value.icon}
                  title={value.title}
                  description={value.description}
                />
              ))}
            </div>

          </div>
        </section>
      )}

      <Modal
        isOpen={!!viewingJob}
        onClose={() => setViewingJob(null)}
        title={viewingJob?.careerTitle || "Career Details"}
        description={`${viewingJob?.location} • ${viewingJob?.employmentType} ${viewingJob?.salaryRange ? `• ${viewingJob.salaryRange}` : ''}`}
        icon={<Briefcase className="w-5 h-5 text-[#30A66F]" />}
        className="max-w-3xl"
        footer={
          <div className="flex w-full justify-between items-center">
            <Button variant="outline" onClick={() => setViewingJob(null)} className="rounded-full px-6">
              Close
            </Button>
            <Button
              onClick={() => {
                setSelectedJob(viewingJob);
                setViewingJob(null);
              }}
              className="bg-[#2a9d5c] hover:bg-[#2a9d5c]/90 text-white rounded-full px-8 shadow-sm"
            >
              Apply Now <ArrowUpRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        }
      >
        {viewingJob && (
          <div className="flex flex-col gap-6 text-foreground text-[15px] sm:text-base px-2 pb-4 max-h-[60vh] overflow-y-auto custom-scrollbar">

            {/* Description */}
            {viewingJob.description && (
              <div>
                <h4 className="font-bold text-[17px] mb-2 text-[#2a9d5c]">Job Description</h4>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed ms-3 md:ms-5">
                  {viewingJob.description}
                </p>
              </div>
            )}

            {/* Key Responsibilities */}
            {viewingJob.keyResponsibilities && (
              <div>
                <h4 className="font-bold text-[17px] mb-2 text-[#2a9d5c]">Key Responsibilities</h4>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed ms-3 md:ms-5">
                  {viewingJob.keyResponsibilities}
                </p>
              </div>
            )}

            {/* Qualifications */}
            {viewingJob.requiredQualifications && (
              <div>
                <h4 className="font-bold text-[17px] mb-2 text-[#2a9d5c]">Required Qualifications</h4>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed ms-3 md:ms-5">
                  {viewingJob.requiredQualifications}
                </p>
              </div>
            )}

            {/* Benefits */}
            {viewingJob.benefits && (
              <div>
                <h4 className="font-bold text-[17px] mb-2 text-[#2a9d5c]">Benefits</h4>
                <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed ms-3 md:ms-5">
                  {viewingJob.benefits}
                </p>
              </div>
            )}

          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedJob}
        onClose={() => {
          setSelectedJob(null);
          form.reset();
          removeFile();
        }}
        title={`Apply for ${selectedJob?.careerTitle}`}
        description="Complete your details and submit your CV"
        icon={<UploadCloud className="w-5 h-5 text-[#30A66F]" />}
        className="max-w-2xl"
        footer={
          <div className="flex w-full justify-between items-center">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedJob(null);
                form.reset();
                removeFile();
              }}
              className="text-primary font-semibold hover:bg-primary/10 border-transparent bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="h-11 md:px-8 font-semibold rounded-lg flex items-center gap-2 bg-[#2a9d5c] hover:bg-[#2a9d5c]/90 text-white"
            >
              {isSubmitting ? (
                <>Submitting... <Loader2 className="w-4 h-4 animate-spin" /></>
              ) : (
                <>Submit Application <CheckSquare className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        }
      >
        <div className="px-1 pb-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <Form {...form}>
            <form id="apply-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground lg:text-[18px] md:text-[16px] sm:text-[14px] text-[12px]">
                      Full Name *
                    </FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} placeholder="Your Full Name" className="h-12 bg-background focus-visible:ring-primary shadow-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground lg:text-[18px] md:text-[16px] sm:text-[14px] text-[12px]">
                      Email Address *
                    </FormLabel>
                    <FormControl>
                      <Input disabled={isSubmitting} type="email" placeholder="your@email.com" className="h-12 bg-background focus-visible:ring-primary shadow-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel className="text-foreground lg:text-[18px] md:text-[16px] sm:text-[14px] text-[12px]">
                  CV/ Resume Upload *
                </FormLabel>

                {!uploadedFile ? (
                  // UPLOAD BOX
                  <div
                    className="border-2 border-dashed border-[#30A66F]/50 rounded-xl p-8 text-center bg-background cursor-pointer hover:border-[#30A66F] transition-colors shadow-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2">Drag & Drop your CV<br />or Click to Upload</h3>
                    <p className="text-sm text-muted-foreground mb-4">Supported Files: PDF, DOCX, JPG, PNG (Max 10MB)</p>
                    <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto" />
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      ref={fileInputRef}
                      disabled={isSubmitting}
                      onChange={handleFileChange}
                    />
                  </div>
                ) : (
                  // PREVIEW BOX (Name + Image/PDF Preview)
                  <div className="border border-[#30A66F]/30 rounded-xl p-4 bg-background shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground font-semibold text-sm truncate">
                            {uploadedFile.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors shrink-0"
                        title="Remove file"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="w-full h-[200px] bg-muted/30 rounded-lg overflow-hidden border border-border/50 flex items-center justify-center relative">
                      {uploadedFile.type.includes('pdf') ? (
                        <iframe
                          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full object-cover pointer-events-none"
                          title="CV Preview"
                        />
                      ) : uploadedFile.type.includes('image') ? (
                        <img
                          src={previewUrl!}
                          alt="CV Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <FileText className="w-10 h-10 mb-2 opacity-30" />
                          <span className="text-xs">Visual preview not available for DOCX</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>
          </Form>
        </div>
      </Modal>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:brightness-110 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </PublicLayout>
  );
}