import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, ArrowUp } from "lucide-react";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorSearchFilters } from "@/components/doctors/doctor-search-filters";
import { LoadingCard } from "@/components/ui/loading-spinner";
import type { DoctorWithDetails, Specialization } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { Pagination } from "@/components/ui/pagination";


export default function FindDoctors() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  
  const [selectedSpecialization, setSelectedSpecialization] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("specialization") || "all";
  });

  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedConsultationType, setSelectedConsultationType] = useState("all");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState("rating");

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const { data: specializations = [], isError: specError } = useQuery<Specialization[]>({
    queryKey: ["/api/specializations"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: cities = [] } = useQuery<string[]>({
    queryKey: ["/api/cities"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: doctors = [], isLoading, isFetching, isError: docsError } = useQuery<DoctorWithDetails[]>({
    queryKey: ["/api/doctors"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const filteredDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];
    
    let filtered = [...doctors];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.user?.fullName.toLowerCase().includes(query) ||
        d.specializations?.some(s => s.name.toLowerCase().includes(query)) ||
        d.hospitals?.some(h => h.name.toLowerCase().includes(query) || h.city.toLowerCase().includes(query))
      );
    }
    
    if (selectedSpecialization !== "all") {
      filtered = filtered.filter(d => 
        d.specializationIds?.includes(selectedSpecialization)
      );
    }
    
    if (selectedCity !== "all") {
      const cityLower = selectedCity.toLowerCase();
      filtered = filtered.filter(d =>
        d.hospitals?.some(h => h.city?.toLowerCase() === cityLower) ||
        d.user?.city?.toLowerCase() === cityLower
      );
    }
    
    if (selectedConsultationType !== "all") {
      filtered = filtered.filter(d => 
        d.consultationTypes?.includes(selectedConsultationType as any)
      );
    }
    
    if (selectedLanguages.length > 0) {
      filtered = filtered.filter(d => 
        selectedLanguages.some(lang => d.languagesSpoken?.includes(lang as any))
      );
    }
    
    if (minRating > 0) {
      filtered = filtered.filter(d => (d.averageRating || 0) >= minRating);
    }
    
    filtered = filtered.filter(d => 
      d.consultationFee >= priceRange[0] && d.consultationFee <= priceRange[1]
    );
    
    switch (sortBy) {
      case "rating":
        filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case "fee_asc":
        filtered.sort((a, b) => a.consultationFee - b.consultationFee);
        break;
      case "fee_desc":
        filtered.sort((a, b) => b.consultationFee - a.consultationFee);
        break;
    }
    
    return filtered;
  }, [doctors, searchQuery, selectedSpecialization, selectedCity, selectedConsultationType, selectedLanguages, minRating, priceRange, sortBy]);

  const itemsPerPage = 6;
  const [currentPage, setCurrentPage] = useUrlPagination(1);
  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  const currentDoctors = useMemo(() => {
    return filteredDoctors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDoctors, startIndex, itemsPerPage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("page")) {
       params.delete("page");
       window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [searchQuery, selectedSpecialization, selectedCity, selectedConsultationType, selectedLanguages.join(","), minRating, priceRange.join("-"), sortBy]);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSpecialization !== "all") count++;
    if (selectedCity !== "all") count++;
    if (selectedConsultationType !== "all") count++;
    if (selectedLanguages.length > 0) count += selectedLanguages.length;
    if (minRating > 0) count++;
    if (priceRange[0] > 0 || priceRange[1] < 10000) count++;
    return count;
  }, [selectedSpecialization, selectedCity, selectedConsultationType, selectedLanguages, minRating, priceRange]);

  const clearFilters = () => {
    setSelectedSpecialization("all");
    setSelectedCity("all");
    setSelectedConsultationType("all");
    setSelectedLanguages([]);
    setMinRating(0);
    setPriceRange([0, 10000]);
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground tracking-tight">
                    Find Your Ayurvedic Doctor
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mt-1">
                    Easily find doctors, manage your bookings and payment history.
                </p>
            </div>
        </div>

        <div className="max-w-7xl mx-auto text-left">
            <DoctorSearchFilters
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedSpecialization={selectedSpecialization}
              onSpecializationChange={setSelectedSpecialization}
              selectedCity={selectedCity}
              onCityChange={setSelectedCity}
              selectedConsultationType={selectedConsultationType}
              onConsultationTypeChange={setSelectedConsultationType}
              selectedLanguages={selectedLanguages}
              onLanguagesChange={setSelectedLanguages}
              minRating={minRating}
              onMinRatingChange={setMinRating}
              priceRange={priceRange}
              onPriceRangeChange={setPriceRange}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              specializations={specializations}
              cities={cities}
              onClearFilters={clearFilters}
              activeFilterCount={activeFilterCount}
            />
        </div>

        <div className={`container mx-auto px-4 pb-8`}>
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredDoctors.length}</span> doctors
          </p>
        </div>

        {isLoading ? (
          <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[...Array(6)].map((_, i) => (
              <LoadingCard key={`loading-${i}`} />
            ))}
          </div>
        ) : docsError ? (
          <div className="mt-12 text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Unable to load doctors</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There was an error loading the doctors list. Please try again later.
            </p>
          </div>
        ) : currentDoctors.length > 0 ? (
          <div className="mt-6 grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {currentDoctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No doctors found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Try adjusting your search filters or browse all available doctors.
            </p>
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="pt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                scrollToTop();
              }}
            />
          </div>
        )}
      </div>
        
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:brightness-110 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}