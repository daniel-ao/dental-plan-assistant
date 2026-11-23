// Realistic French dictations of the 5 client notes (same clinical content as data/dentist_notes_EN.txt),
// written the way a French-speaking dentist says them, plus raw voice-style transcripts.
export const FR = {
  1: `Étape 1
• Surfaçage radiculaire, 1 segment
• Hygiène préopératoire, avec remise
• Sinus lift pendant la pose des implants, 2 à 3 implants
• Implants en 45, 35, 37
• Greffe osseuse pendant la pose des implants, autour d'un implant – gratuite dans le cadre du programme « Doluchys »
• 1 pack de stérilisation
• Sédation, 4 h / sans sédation

Étape 2 – après 3 mois
• Vis de cicatrisation sur 3 implants + greffe gingivale autour de 3 implants + 3 x anesthésie locale + 1 kit d'hygiène à usage unique
• Scan de 3 implants
• Couronnes provisoires sur 4 implants + modèle + kit d'hygiène à usage unique

Étape 3
• Hygiène préopératoire, avec remise
• Implants en 15, 16
• 1 pack de stérilisation

Étape 4
• Vis de cicatrisation sur 2 implants + 2 x greffe gingivale + 2 x anesthésie locale + 1 kit d'hygiène à usage unique
• Scan de 2 implants
• Couronnes provisoires sur 2 implants + 1 modèle + 1 kit d'hygiène à usage unique

Étape 4
• Scan de 5 implants
• Couronnes zircone sur 7 implants + modèle + kit d'hygiène à usage unique
• Obturation des puits d'accès des vis des couronnes sur implants`,

  2: `Étape 1
• Hygiène préopératoire, avec remise
• Élévation du sinus pendant la pose des implants, 2 à 3 implants
• Implants en 15, 35, 36 – gratuits dans le cadre du programme « Doluchys »
• Sédation, 4 h / sans sédation

Étape 2
• Piliers de cicatrisation sur 3 implants + greffe gingivale autour de 3 implants
• Pose de 2 implants en 16 et 17
• 1 pack de stérilisation
• Scan de 3 implants
• Couronnes provisoires sur 4 implants + modèle + kit d'hygiène à usage unique

Étape 3
• Vis de cicatrisation sur 2 implants + 2 x greffe gingivale + 2 x anesthésie locale + 1 kit d'hygiène à usage unique
• Scan de 2 implants
• Couronnes provisoires sur 2 implants + 1 modèle + 1 kit d'hygiène à usage unique

Étape 4
• Scan de 5 implants
• Couronnes en zircone sur 6 implants + modèle + kit d'hygiène à usage unique
• Fermeture des puits de vissage des couronnes sur implants`,

  3: `« Calcule un devis pour un militaire (-30 %).
Étape 1 : hygiène préopératoire, utilisation d'un pack de stérilisation, greffe osseuse dans le segment 1
au prix du tarif de 630 €. Pose de quatre implants : sites 16, 15, 35 et 36.
Sédation.
Étape 2 : calcule la pose des vis de cicatrisation avec une remise de 30 % sur les sites 16, 15, 35
et 36. Ensuite, calcule aussi, pour le militaire, une greffe gingivale autour de chaque
implant. En étape 2, ajoute aussi le coût des couronnes provisoires sur les implants. »`,

  4: `• Le patient joue du saxophone (loisir)
• Accepte de ne pas jouer pendant six mois si nécessaire
• Extraire les 4 dents de devant et poser 2 ou 3 implants
• Implants Straumann avec couronnes zircone
• 2 implants, enfouis (vis de couverture), provisoires
• 890 € par implant, 500 € par couronne
• Sous charge, le col de l'implant peut se fissurer si on utilise des implants coréens
• On fera une remise sur les implants (à confirmer avec le Dr R.A.)
• Implants en 22 et 12
• Éventuellement meulage de la dent du bas – 43
• Viser une occlusion bout à bout
• Implants à 750 € pièce
• Prothésiste : Mariana
• Calculer le devis complet`,

  5: `• Pas d'os dans le segment 4
• Augmentation osseuse nécessaire d'abord
• Ne pourra pas porter de prothèse amovible pendant la cicatrisation
• Également greffe osseuse préalable dans le segment 1
• Porte actuellement des prothèses amovibles
• Pologne / région de Kherson
• Le Dr R.A. fera la chirurgie
• 1re visite – 3 jours pour l'augmentation osseuse
• Après 4 à 6 mois : implants – 3 jours
• Après 3 à 4 mois : provisoires
• N'aime pas ses couronnes actuelles ? Elle dit que ces dents doivent être extraites parce qu'elles sont abîmées
• Les dents sont en bon état – elles n'ont pas besoin d'être extraites
• Segment 1 : éventuellement technique lamina (coque osseuse) ou sinus lift
• 2 implants par côté, mais 3 dents
• Souhaite aussi des soins conservateurs
• Pas d'inflammation
• Greffe osseuse 1 200 à 1 400 € par côté
• Implants 470 € et 890 €
• Devis approximatif
• Hébergement du patient (chambres)
• Devra se ménager pendant quelques jours
• Éventuellement l'adresser pour un examen en Pologne
• Passage à la zircone après 1 mois ou plus`,
};

// PRD demo case, French.
export const FR_DEMO = `Je recommande de remplacer la première molaire supérieure droite manquante, la dent 16, par un implant.
Étape 1 : bilan avec une radiographie dentaire, hygiène préopératoire, pose d'un implant en 16.
Étape 2 : vis de cicatrisation sur 1 implant.
Étape 3 : couronne céramique sur 1 implant, obturation du puits d'accès de la vis.`;

// What Chrome's fr-FR speech recognition actually returns: no bullets, little punctuation, lowercase,
// some numbers spelled out. The app inserts a line break before each "étape".
export const FR_VOICE = `étape 1 consultation et radio panoramique hygiène préopératoire avec une remise de 10 % extraction de la 36 pose d'un implant en 36 sédation 2 heures
étape 2 après 3 mois vis de cicatrisation sur un implant scan d'un implant
étape 3 après un mois couronne zircone sur un implant obturation du puits d'accès`;
