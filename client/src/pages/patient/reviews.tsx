import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Star, MessageSquare, AlertCircle, Edit2, Trash2,
  ThumbsUp, Filter, CalendarCheck, Clock, FileText, CheckCircle2,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { LoadingPage, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PatientReviews() {
  const { toast } = useToast();
  const [filterRating, setFilterRating] = useState<string>("all");

  // State for Add Review Modal
  const [isAddingReview, setIsAddingReview] = useState(false);
  const [selectedPendingDoc, setSelectedPendingDoc] = useState<any>(null);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");

  // State for Edit Review Modal
  const [editingReview, setEditingReview] = useState<any>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");

  const { data: reviews = [], isLoading: isLoadingReviews, isError } = useQuery<any[]>({
    queryKey: ["/api/patient/reviews"],
  });

  const { data: appointments = [], isLoading: isLoadingApts } = useQuery<any[]>({
    queryKey: ["/api/appointments"],
  });

  // Data Mutations
  const createMutation = useMutation({
    mutationFn: (data: { appointmentId: string; doctorId: string; rating: number; comment: string }) =>
      apiRequest("POST", `/api/appointments/${data.appointmentId}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsAddingReview(false);
      setNewRating(0);
      setNewComment("");
      toast({ title: "Review published successfully!" });
    },
    onError: () => toast({ title: "Failed to publish review", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, rating, comment }: { id: string; rating: number; comment: string }) =>
      apiRequest("PATCH", `/api/reviews/${id}`, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient/reviews"] });
      setEditingReview(null);
      toast({ title: "Review updated successfully!" });
    },
    onError: () => toast({ title: "Failed to update review", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "Review deleted successfully!" });
    },
  });

  // Find pending reviews (completed appointments without a review)
  const pendingAppointments = appointments.filter(
    (app) => app.status === "completed" && !reviews.some((r) => r.appointmentId === app.id)
  );

  // Group by doctor to avoid duplicate pending prompts for the same doctor
  const uniquePendingDocsMap = new Map();
  pendingAppointments.forEach(app => {
    if (!uniquePendingDocsMap.has(app.doctorId)) {
      uniquePendingDocsMap.set(app.doctorId, app);
    }
  });
  const pendingReviewsList = Array.from(uniquePendingDocsMap.values());

  const getInitials = (name: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "DR";

  const renderStars = (rating: number, interactive = false, onSelect?: (r: number) => void) => (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-8 w-8 sm:h-10 sm:w-10 ${star <= rating ? "fill-amber-500 text-amber-500" : "text-slate-200 dark:text-zinc-700"} ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          onClick={() => interactive && onSelect && onSelect(star)}
          onMouseEnter={() => interactive && onSelect && onSelect(star)}
        />
      ))}
    </div>
  );

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const filteredReviews = reviews.filter(r => filterRating === "all" ? true : r.rating === parseInt(filterRating));

  const handleOpenAddReview = (appointment: any) => {
    setSelectedPendingDoc(appointment);
    setNewRating(0);
    setNewComment("");
    setIsAddingReview(true);
  };

  const handleEditClick = (review: any) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment || "");
  };

  const handleUpdateReview = () => {
    if (editingReview) {
      updateMutation.mutate({
        id: editingReview.id,
        rating: editRating,
        comment: editComment,
      });
    }
  };

  if (isLoadingReviews || isLoadingApts) return <LoadingPage message="Loading your reviews..." />;

  if (isError) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <p className="text-muted-foreground font-medium">Failed to load. Please try again.</p>
      <Button onClick={() => window.location.reload()} className="bg-primary/60 hover:bg-primary/70">Retry</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">My Reviews</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Share feedback to help others find the best care.</p>
        </div>
      </div>

      <Tabs defaultValue={pendingReviewsList.length > 0 ? "pending" : "published"} className="w-full">
        <TabsList className="bg-slate-100 dark:bg-zinc-900/80 rounded-2xl p-1 w-full sm:w-auto flex h-auto mb-6">
          <TabsTrigger value="pending" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary dark:data-[state=active]:text-primary data-[state=active]:shadow-sm">
            To Review {pendingReviewsList.length > 0 && <Badge className="ml-2 bg-destructive/90 hover:destructive px-1.5 py-0 min-w-[20px]">{pendingReviewsList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-primary dark:data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Published ({reviews.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PENDING REVIEWS */}
        <TabsContent value="pending" className="mt-0 outline-none">
          <Card className="border-0 bg-transparent shadow-none">
            {pendingReviewsList.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-[2rem] p-12 text-center">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">You're all caught up!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto mb-6">
                  You have no pending reviews. Complete an appointment to share your experience.
                </p>
                <Link href="/patient/appointments">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8 font-bold"><CalendarCheck className="w-5 h-5 mr-2" /> Book Appointment</Button>
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingReviewsList.map((app) => (
                  <div key={app.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
                    <Avatar className="h-20 w-20 border-4 border-emerald-50 dark:border-emerald-900/30 shadow-sm mb-4">
                      <AvatarImage src={app.doctor.user?.profileImage} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">{getInitials(app.doctor.user?.fullName)}</AvatarFallback>
                    </Avatar>
                    <h4 className="font-black text-lg text-slate-900 dark:text-white">Dr. {app.doctor.user?.fullName}</h4>
                    <p className="text-sm font-bold text-primary dark:text-primary">{app.doctor.specializations?.[0]?.name}</p>

                    <div className="mt-4 mb-6 px-4 py-2 bg-slate-50 dark:bg-zinc-950 rounded-xl w-full text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Visited on {format(parseISO(app.appointmentDate), "MMM dd, yyyy")}
                    </div>

                    <Button onClick={() => handleOpenAddReview(app)} className="w-full bg-secondary/90 hover:bg-secondary text-white rounded-xl font-bold h-12 shadow-sm">
                      <Star className="w-4 h-4 mr-2 fill-white" /> Rate Experience
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: PUBLISHED REVIEWS */}
        <TabsContent value="published" className="mt-0 outline-none">
          {reviews.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 shadow-sm rounded-[2rem] p-12 text-center">
              <div className="bg-amber-50 dark:bg-amber-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="h-10 w-10 text-secondary fill-amber-500/20" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Published Reviews</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto mb-8">Your feedback helps other patients make informed decisions.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">

              {/* 📋 Reviews List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Your Feedbacks</h3>
                  <Select value={filterRating} onValueChange={setFilterRating}>
                    <SelectTrigger className="w-[140px] bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl font-bold h-10 shadow-sm">
                      <Filter className="w-4 h-4 text-emerald-600 mr-2" /> <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Stars</SelectItem>
                      {[5, 4, 3, 2, 1].map(s => <SelectItem key={s} value={s.toString()}>{s} Stars</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  {filteredReviews.length === 0 ? (
                    <p className="text-center text-slate-400 font-bold py-10">No reviews found for this filter.</p>
                  ) : (
                    filteredReviews.map((review) => (
                      <div key={review.id} className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 sm:p-8 hover:shadow-md transition-shadow relative overflow-hidden">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl shadow-sm shrink-0">
                              <AvatarImage src={review.doctor?.user?.profileImage} className="object-cover" />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-lg rounded-2xl">{getInitials(review.doctor?.user?.fullName)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">Dr. {review.doctor?.user?.fullName}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-amber-500 text-amber-500" : "text-slate-200 dark:text-zinc-700"}`} />)}
                                </div>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700"></span>
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">{format(parseISO(review.createdAt), "MMM dd, yyyy")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md text-emerald-600 hover:bg-white dark:hover:bg-zinc-700" onClick={() => handleEditClick(review)}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md text-rose-500 hover:bg-white dark:hover:bg-zinc-700"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="font-black text-xl">Delete this review?</AlertDialogTitle>
                                  <AlertDialogDescription className="font-medium">Are you sure you want to permanently delete your feedback for Dr. {review.doctor?.user?.fullName}?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-4">
                                  <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(review.id)} className="rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium mt-2">{review.comment}</p>

                        {review.doctorResponse && (
                          <div className="mt-5 bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border-l-4 border-emerald-500">
                            <p className="text-[10px] sm:text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><ThumbsUp className="w-3.5 h-3.5" /> Doctor's Reply</p>
                            <p className="text-sm text-emerald-900/80 dark:text-emerald-100/70 italic font-medium">{review.doctorResponse}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================================= */}
      {/* MODALS: ADD REVIEW & EDIT REVIEW */}
      {/* ================================================================================= */}

      {/* Add Review Dialog */}
      <Dialog open={isAddingReview} onOpenChange={setIsAddingReview}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] p-0 overflow-hidden border-border bg-white dark:bg-zinc-950">
          <div className="p-6 sm:p-8 bg-amber-50 dark:bg-amber-900/10 border-b border-border text-center">
            <div className="w-16 h-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Star className="w-8 h-8 text-amber-500 fill-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white">Rate your experience</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-2">How was your appointment with Dr. {selectedPendingDoc?.doctor?.user?.fullName}?</DialogDescription>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex justify-center p-2">{renderStars(newRating, true, setNewRating)}</div>
            <div className="space-y-3">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Share your thoughts</Label>
              <Textarea
                value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="Tell us what you liked about the visit..." rows={4}
                className="rounded-2xl border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 focus-visible:ring-amber-500"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate({ appointmentId: selectedPendingDoc.id, doctorId: selectedPendingDoc.doctorId, rating: newRating, comment: newComment })}
              disabled={createMutation.isPending || newRating === 0 || newComment.length < 5}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-12 font-bold text-base shadow-sm"
            >
              {createMutation.isPending ? <LoadingSpinner className="w-5 h-5" /> : "Publish Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Review Dialog */}
      <Dialog open={!!editingReview} onOpenChange={(open) => !open && setEditingReview(null)}>
        <DialogContent className="sm:max-w-lg rounded-[2rem] p-0 overflow-hidden border-border bg-white dark:bg-zinc-950">
          <div className="p-6 sm:p-8 bg-emerald-50 dark:bg-emerald-900/10 border-b border-border">
            <DialogTitle className="text-xl font-black text-emerald-900 dark:text-emerald-100">Edit Feedback</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">Update your review for Dr. {editingReview?.doctor?.user?.fullName}</DialogDescription>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex justify-center p-4 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
              {renderStars(editRating, true, setEditRating)}
            </div>
            <div className="space-y-3">
              <Label className="font-bold text-slate-700 dark:text-slate-300">Comment</Label>
              <Textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={4} className="rounded-2xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-visible:ring-emerald-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditingReview(null)} className="rounded-xl font-bold">Cancel</Button>
              <Button onClick={handleUpdateReview} disabled={updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 font-bold shadow-sm">
                {updateMutation.isPending ? <LoadingSpinner className="w-5 h-5" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}