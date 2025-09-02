import React, { useState } from 'react';
import invoice1 from '../../../assets/fatures/affiche1.png';
import invoice2 from '../../../assets/fatures/affiche2.png';
import invoice3 from '../../../assets/fatures/affiche3.png';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Filter, Plus, Upload } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const FacturesTemplates: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        title: '',
        description: '',
        category: 'standard',
        tags: '',
        image: null as File | null
    });

    // Initial templates data
    const [templates, setTemplates] = useState([
        {
            id: 1,
            title: 'Facture Standard',
            description: 'Template de facture standard pour les transactions régulières.',
            image: invoice1,
            category: 'standard',
            tags: ['facture', 'standard', 'vente']
        },
        {
            id: 2,
            title: 'Facture Proforma',
            description: 'Template de facture proforma pour les devis et estimations.',
            image: invoice2,
            category: 'proforma',
            tags: ['proforma', 'devis', 'estimation']
        },
        {
            id: 3,
            title: 'Bon de Livraison',
            description: 'Template de bon de livraison pour accompagner les expéditions.',
            image: invoice3,
            category: 'livraison',
            tags: ['livraison', 'expédition', 'transport']
        },
    ]);

    const downloadPDF = (templateId: number) => {
        // Check if we have a PDF file for this template
        if (pdfFiles[templateId]) {
            // Create a URL for the PDF file
            const fileURL = URL.createObjectURL(pdfFiles[templateId]);

            // Create a link element
            const downloadLink = document.createElement('a');
            downloadLink.href = fileURL;
            downloadLink.download = `template-${templateId}.pdf`;

            // Trigger the download
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            // Clean up the URL object
            URL.revokeObjectURL(fileURL);
        } else {
            // For demo templates or templates without PDF files
            console.log(`Téléchargement du template ${templateId} (aucun fichier PDF disponible)`);
            alert('Ceci est un template de démonstration. Aucun fichier PDF n\'est disponible pour ce template.');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewTemplate(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Store PDF files with their template IDs
    const [pdfFiles, setPdfFiles] = useState<Record<number, File>>({});

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            // Check if the file is a PDF
            if (e.target.files[0].type === 'application/pdf') {
                setNewTemplate(prev => ({
                    ...prev,
                    image: e.target.files![0]
                }));
            } else {
                alert('Veuillez sélectionner un fichier PDF');
                e.target.value = '';
            }
        }
    };

    const handleAddTemplate = () => {
        const templateId = templates.length + 1;

        // Create a new template object
        const newTemplateObj = {
            id: templateId,
            title: newTemplate.title,
            description: newTemplate.description,
            // Use a placeholder image for PDF templates
            image: invoice1, // Using a default image as placeholder for PDF
            category: newTemplate.category,
            tags: newTemplate.tags.split(',').map(tag => tag.trim())
        };

        // Store the PDF file if it exists
        if (newTemplate.image) {
            setPdfFiles(prev => ({
                ...prev,
                [templateId]: newTemplate.image as File
            }));
        }

        // Add the new template to the templates array
        setTemplates([...templates, newTemplateObj]);

        // Reset the form
        setNewTemplate({
            title: '',
            description: '',
            category: 'standard',
            tags: '',
            image: null
        });

        // Close the dialog
        setIsDialogOpen(false);
    };

    // Filter templates based on search term and category
    const filteredTemplates = templates.filter(template => {
        const matchesSearch =
            template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold">Templates de Factures</h1>

                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un template..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Select
                        value={categoryFilter}
                        onValueChange={setCategoryFilter}
                    >
                        <SelectTrigger className="w-full md:w-[180px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Filtrer par catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les catégories</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="proforma">Proforma</SelectItem>
                            <SelectItem value="livraison">Livraison</SelectItem>
                        </SelectContent>
                    </Select>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full md:w-auto">
                                <Plus className="h-4 w-4 mr-2" />
                                Ajouter un template
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Ajouter un nouveau template</DialogTitle>
                                <DialogDescription>
                                    Remplissez les informations pour créer un nouveau template de facture.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="title" className="text-right">
                                        Titre
                                    </Label>
                                    <Input
                                        id="title"
                                        name="title"
                                        value={newTemplate.title}
                                        onChange={handleInputChange}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="description" className="text-right">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="description"
                                        name="description"
                                        value={newTemplate.description}
                                        onChange={handleInputChange}
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="category" className="text-right">
                                        Catégorie
                                    </Label>
                                    <Select
                                        value={newTemplate.category}
                                        onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}
                                    >
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Sélectionner une catégorie" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">Standard</SelectItem>
                                            <SelectItem value="proforma">Proforma</SelectItem>
                                            <SelectItem value="livraison">Livraison</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="tags" className="text-right">
                                        Tags
                                    </Label>
                                    <Input
                                        id="tags"
                                        name="tags"
                                        value={newTemplate.tags}
                                        onChange={handleInputChange}
                                        placeholder="Séparés par des virgules"
                                        className="col-span-3"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="image" className="text-right">
                                        Fichier PDF
                                    </Label>
                                    <div className="col-span-3">
                                        <Input
                                            id="image"
                                            type="file"
                                            accept="application/pdf"
                                            onChange={handleImageChange}
                                            className="cursor-pointer"
                                        />
                                        {newTemplate.image && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {newTemplate.image.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Annuler
                                </Button>
                                <Button type="button" onClick={handleAddTemplate} disabled={!newTemplate.title || !newTemplate.description}>
                                    Ajouter
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    Aucun template ne correspond à votre recherche.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map((template) => (
                        <Card key={template.id} className="overflow-hidden hover:shadow-lg transition-all">
                            <div className="aspect-video overflow-hidden">
                                <img
                                    src={template.image}
                                    alt={template.title}
                                    className="w-full h-full object-cover transition-transform hover:scale-105"
                                />
                            </div>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle>{template.title}</CardTitle>
                                    <Badge variant="outline">{template.category}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">{template.description}</p>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {template.tags.map((tag, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    className="w-full"
                                    onClick={() => downloadPDF(template.id)}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Télécharger en PDF
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FacturesTemplates;