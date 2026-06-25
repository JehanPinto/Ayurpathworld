import { useState, useEffect } from "react";
import { Search, Filter, X, MapPin, Star, SlidersHorizontal, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ConsultationType, Language } from "@shared/schema";
import type { Specialization } from "@shared/schema";

const LANGUAGES = [
  { value: Language.ENGLISH, label: "English" },
  { value: Language.SINHALA, label: "Sinhala" },
  { value: Language.TAMIL, label: "Tamil" },
];

const CONSULTATION_TYPES = [
  { value: ConsultationType.IN_PERSON, label: "In Person" },
  { value: ConsultationType.ONLINE, label: "Online" },
];

const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "fee_asc", label: "Price: Low to High" },
  { value: "fee_desc", label: "Price: High to Low" },
  { value: "experience", label: "Most Experienced" },
];

interface DoctorSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedSpecialization: string;
  onSpecializationChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (value: string) => void;
  selectedConsultationType: string;
  onConsultationTypeChange: (value: string) => void;
  selectedLanguages: string[];
  onLanguagesChange: (value: string[]) => void;
  minRating: number;
  onMinRatingChange: (value: number) => void;
  priceRange: [number, number];
  onPriceRangeChange: (value: [number, number]) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  specializations: Specialization[];
  cities: string[];
  onClearFilters: () => void;
  activeFilterCount: number;
}

export function DoctorSearchFilters({
  searchQuery,
  onSearchChange,
  selectedSpecialization,
  onSpecializationChange,
  selectedCity,
  onCityChange,
  selectedConsultationType,
  onConsultationTypeChange,
  selectedLanguages,
  onLanguagesChange,
  minRating,
  onMinRatingChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortByChange,
  specializations,
  cities,
  onClearFilters,
  activeFilterCount,
}: DoctorSearchFiltersProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const [localSpecialization, setLocalSpecialization] = useState(selectedSpecialization);
  const [localCity, setLocalCity] = useState(selectedCity);
  const [localSortBy, setLocalSortBy] = useState(sortBy);

  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => { setInputValue(searchQuery); }, [searchQuery]);
  useEffect(() => { setLocalSpecialization(selectedSpecialization); }, [selectedSpecialization]);
  useEffect(() => { setLocalCity(selectedCity); }, [selectedCity]);
  useEffect(() => { setLocalSortBy(sortBy); }, [sortBy]);

  function handleSearch() {
    onSearchChange(inputValue);
    onSpecializationChange(localSpecialization);
    onCityChange(localCity);
    onSortByChange(localSortBy);
    setIsFilterOpen(false);
  }

  function toggleLanguage(language: string) {
    if (selectedLanguages.includes(language)) {
      onLanguagesChange(selectedLanguages.filter((l) => l !== language));
    } else {
      onLanguagesChange([...selectedLanguages, language]);
    }
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!isMounted) return null;

  return (
    <div className="w-full flex flex-col gap-4">

      {/* --- MAIN TOOLBAR --- */}
      <div className="flex items-center gap-3 w-full bg-card border border-primary/40 p-2 rounded-[2rem] shadow-sm">

        {/* Search Input */}
        <div className="relative flex items-center flex-1 h-12 bg-muted/40 rounded-full px-5 overflow-hidden">
          <input
            placeholder="Search doctors by name..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-foreground placeholder:text-muted-foreground w-full"
            data-testid="input-search-doctors"
          />
          {inputValue && (
            <button
              onClick={() => { setInputValue(""); onSearchChange(""); }}
              className="p-1 rounded-full hover:bg-muted transition-colors focus:outline-none shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Desktop Quick Dropdowns (hidden on screens smaller than lg) */}
        <div className="hidden xl:flex items-center gap-3 shrink-0">

          <Select value={localSpecialization} onValueChange={setLocalSpecialization}>
            <SelectTrigger className="h-12 rounded-full border-border/60 bg-background hover:bg-muted/30 text-sm font-medium w-[200px] shadow-none">
              <Stethoscope className="h-4 w-4 text-muted-foreground mr-2" />
              <SelectValue placeholder="Specializations" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all" className="font-semibold text-primary">All Specializations</SelectItem>
              {specializations.map((spec) => (
                <SelectItem key={spec.id} value={spec.id}>{spec.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={localCity} onValueChange={setLocalCity}>
            <SelectTrigger className="h-12 rounded-full border-border/60 bg-background hover:bg-muted/30 text-sm font-medium w-[160px] shadow-none">
              <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all" className="font-semibold text-primary">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={localSortBy} onValueChange={setLocalSortBy}>
            <SelectTrigger className="h-12 rounded-full border-border/60 bg-background hover:bg-muted/30 text-sm font-medium w-[180px] shadow-none">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground mr-2" />
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Button (Opens Sheet) */}
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant={activeFilterCount > 0 ? "default" : "outline"}
              className={`h-12 rounded-full px-5 md:px-6 shrink-0 shadow-none transition-all ${
                activeFilterCount > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border-border/60 hover:bg-muted/50"
              }`}
            >
              <Filter className={`h-4 w-4 mr-2 ${activeFilterCount > 0 ? "" : "text-muted-foreground"}`} />
              <span className="hidden sm:inline-block font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <Badge className="ml-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center bg-white text-primary hover:bg-white border-0">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent className="w-[95vw] sm:max-w-[450px] p-0 flex flex-col border-l-border/30">

            <SheetHeader className="p-6 border-b border-border/40 shrink-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-xl font-bold font-heading">Advanced Filters</SheetTitle>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">

              {/* Mobile Only: Quick Filters inside sheet */}
              <div className="block lg:hidden space-y-6 pb-6 border-b border-border/40">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Specialization</Label>
                  <Select value={localSpecialization} onValueChange={setLocalSpecialization}>
                    <SelectTrigger className="w-full h-12 rounded-xl bg-muted/30">
                      <SelectValue placeholder="All Specializations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-semibold text-primary">All Specializations</SelectItem>
                      {specializations.map((spec) => (
                        <SelectItem key={spec.id} value={spec.id}>{spec.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Location</Label>
                  <Select value={localCity} onValueChange={setLocalCity}>
                    <SelectTrigger className="w-full h-12 rounded-xl bg-muted/30">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-semibold text-primary">All Cities</SelectItem>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Sort By</Label>
                  <Select value={localSortBy} onValueChange={setLocalSortBy}>
                    <SelectTrigger className="w-full h-12 rounded-xl bg-muted/30">
                      <SelectValue placeholder="Sort Options" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Consultation Type */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Consultation Type</Label>
                <div className="flex flex-wrap gap-2">
                  {CONSULTATION_TYPES.map((type) => (
                    <Badge
                      key={type.value}
                      variant={selectedConsultationType === type.value ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 text-sm transition-all rounded-full border ${
                        selectedConsultationType === type.value
                          ? "bg-primary text-primary-foreground shadow-md border-primary"
                          : "hover:bg-primary/10 border-border/50 bg-background text-foreground"
                      }`}
                      onClick={() => onConsultationTypeChange(
                        selectedConsultationType === type.value ? "all" : type.value
                      )}
                    >
                      {type.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className="space-y-4">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Languages</Label>
                <div className="grid grid-cols-2 gap-3">
                  {LANGUAGES.map((lang) => (
                    <div
                      key={lang.value}
                      className={`flex items-center space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                        selectedLanguages.includes(lang.value)
                          ? "bg-primary/5 border-primary/40"
                          : "bg-muted/30 border-border/30 hover:border-border"
                      }`}
                      onClick={() => toggleLanguage(lang.value)}
                    >
                      <Checkbox
                        id={lang.value}
                        checked={selectedLanguages.includes(lang.value)}
                        onCheckedChange={() => toggleLanguage(lang.value)}
                        className="border-primary/50 data-[state=checked]:bg-primary"
                      />
                      <label className="text-sm font-medium cursor-pointer flex-1 select-none">
                        {lang.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Minimum Rating */}
              <div className="space-y-6">
                <Label className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Minimum Rating
                  </span>
                  <span className="text-foreground bg-secondary/10 text-secondary-foreground px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {minRating > 0 ? `${minRating.toFixed(1)}+` : "Any"}
                  </span>
                </Label>
                <Slider
                  value={[minRating]}
                  onValueChange={([value]) => onMinRatingChange(value)}
                  max={5}
                  step={0.5}
                  className="w-full"
                />
              </div>

              {/* Price Range */}
              <div className="space-y-6">
                <Label className="flex flex-col gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Consultation Fee</span>
                  <span className="text-foreground normal-case font-bold text-base">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                  </span>
                </Label>
                <Slider
                  value={priceRange}
                  onValueChange={(value) => onPriceRangeChange(value as [number, number])}
                  min={0}
                  max={10000}
                  step={500}
                  className="w-full"
                />
              </div>

            </div>

            <SheetFooter className="p-6 border-t border-border/40 bg-background shrink-0 mt-auto">
              <Button
                className="w-full h-12 text-base font-bold rounded-xl shadow-lg"
                onClick={handleSearch}
              >
                Apply Filters
              </Button>
            </SheetFooter>

          </SheetContent>
        </Sheet>

        {/* Green Search Button */}
        <Button
          type="button"
          onClick={handleSearch}
          className="h-12 py-0 rounded-3xl bg-primary hover:bg-primary/90 shrink-0 flex items-center justify-center transition-colors cursor-pointer relative z-10"
        >
          Search
          <Search className="h-5 w-5 text-white" />
        </Button>

      </div>

      {/* --- ACTIVE FILTERS ROW --- */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-2 animate-in fade-in duration-300">
          <span className="text-sm font-medium text-muted-foreground mr-1">Active:</span>

          {selectedSpecialization !== "all" && (
            <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-full">
              {specializations.find((s) => s.id === selectedSpecialization)?.name}
              <X className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => onSpecializationChange("all")} />
            </Badge>
          )}

          {selectedCity !== "all" && (
            <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-full">
              {selectedCity}
              <X className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => onCityChange("all")} />
            </Badge>
          )}

          {selectedConsultationType !== "all" && (
            <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-full">
              {CONSULTATION_TYPES.find((c) => c.value === selectedConsultationType)?.label}
              <X className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => onConsultationTypeChange("all")} />
            </Badge>
          )}

          {selectedLanguages.map((lang) => (
            <Badge key={lang} variant="secondary" className="px-3 py-1.5 gap-1.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 rounded-full">
              {LANGUAGES.find((l) => l.value === lang)?.label}
              <X className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => toggleLanguage(lang)} />
            </Badge>
          ))}

          {minRating > 0 && (
            <Badge variant="secondary" className="px-3 py-1.5 gap-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 rounded-full">
              <Star className="h-3 w-3 fill-current" />
              {minRating}+ Stars
              <X className="h-3.5 w-3.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => onMinRatingChange(0)} />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-destructive text-sm h-8 px-3 rounded-full hover:bg-destructive/10 ml-auto sm:ml-0"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
