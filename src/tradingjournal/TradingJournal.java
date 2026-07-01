package tradingjournal;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Desktop;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

public class TradingJournal extends JFrame {
    private static final String DATA_FILE = "trades.dat";
    private static final Path IMAGE_DIR = Paths.get("journal_images");

    private final JSpinner dateSpinner;
    private final JSpinner timeSpinner;
    private final JSpinner tradesSpinner;
    private final JSpinner contractCountSpinner;
    private final JTextField contractNamesField;
    private final JLabel screenshotLabel;
    private final JLabel totalTradesLabel;
    private final JTable tradeTable;
    private final DefaultTableModel tableModel;

    private File selectedScreenshot;
    private final List<TradeEntry> trades = new ArrayList<>();
    private int runningTotal = 0;

    public TradingJournal() {
        super("Trading Journal");
        setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        setLayout(new BorderLayout(10, 10));

        dateSpinner = new JSpinner(new SpinnerDateModel(new Date(), null, null, java.util.Calendar.DAY_OF_MONTH));
        ((JSpinner.DateEditor) dateSpinner.getEditor()).getFormat().applyPattern("yyyy-MM-dd");

        timeSpinner = new JSpinner(new SpinnerDateModel(new Date(), null, null, java.util.Calendar.MINUTE));
        ((JSpinner.DateEditor) timeSpinner.getEditor()).getFormat().applyPattern("HH:mm");

        tradesSpinner = new JSpinner(new SpinnerNumberModel(1, 1, 10_000, 1));
        contractCountSpinner = new JSpinner(new SpinnerNumberModel(1, 1, 10_000, 1));
        contractNamesField = new JTextField();
        screenshotLabel = new JLabel("No screenshot selected");
        totalTradesLabel = new JLabel("Total trades recorded: 0");

        JButton addTradeButton = new JButton("Add Trade");
        addTradeButton.addActionListener(this::addTrade);

        JButton selectScreenshotButton = new JButton("Attach Screenshot");
        selectScreenshotButton.addActionListener(this::selectScreenshot);

        JPanel formPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.gridx = 0;
        gbc.gridy = 0;
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.weightx = 0.3;
        gbc.insets.set(5, 5, 5, 5);

        formPanel.add(new JLabel("Date trade taken:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(dateSpinner, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.weightx = 0.3;
        formPanel.add(new JLabel("Time trade taken:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(timeSpinner, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.weightx = 0.3;
        formPanel.add(new JLabel("Amount of trades taken:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(tradesSpinner, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.weightx = 0.3;
        formPanel.add(new JLabel("Number of contracts:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(contractCountSpinner, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.weightx = 0.3;
        formPanel.add(new JLabel("Which contracts:"), gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(contractNamesField, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.weightx = 0.3;
        formPanel.add(selectScreenshotButton, gbc);
        gbc.gridx = 1;
        gbc.weightx = 0.7;
        formPanel.add(screenshotLabel, gbc);

        gbc.gridx = 0;
        gbc.gridy++;
        gbc.gridwidth = 2;
        gbc.weightx = 1.0;
        gbc.anchor = GridBagConstraints.CENTER;
        formPanel.add(addTradeButton, gbc);

        gbc.gridy++;
        formPanel.add(totalTradesLabel, gbc);

        tableModel = new DefaultTableModel(
                new Object[]{"Date", "Time", "Trades Taken", "Contract Count", "Contract Details", "Total Trades", "Screenshot"}, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return column == 6;
            }
        };

        tradeTable = new JTable(tableModel);
        tradeTable.setRowHeight(28);
        tradeTable.getColumnModel().getColumn(6).setCellRenderer(new ScreenshotButtonRenderer());
        tradeTable.getColumnModel().getColumn(6).setCellEditor(new ScreenshotButtonEditor());

        JScrollPane tableScroll = new JScrollPane(tradeTable);
        tableScroll.setPreferredSize(new Dimension(1000, 400));

        add(formPanel, BorderLayout.NORTH);
        add(tableScroll, BorderLayout.CENTER);

        loadTrades();
        pack();
        setLocationRelativeTo(null);
    }

    private void addTrade(ActionEvent event) {
        LocalDate date = toLocalDate((Date) dateSpinner.getValue());
        LocalTime time = toLocalTime((Date) timeSpinner.getValue());
        int tradesTaken = ((Number) tradesSpinner.getValue()).intValue();
        int contractCount = ((Number) contractCountSpinner.getValue()).intValue();
        String contractNames = contractNamesField.getText().trim();

        if (contractNames.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Please describe which contracts were traded.", "Missing contracts", JOptionPane.WARNING_MESSAGE);
            return;
        }

        String storedScreenshot = null;
        if (selectedScreenshot != null) {
            try {
                storedScreenshot = storeScreenshot(selectedScreenshot).toString();
            } catch (IOException e) {
                JOptionPane.showMessageDialog(this, "Could not save screenshot: " + e.getMessage(), "Screenshot error", JOptionPane.ERROR_MESSAGE);
                return;
            }
        }

        runningTotal += tradesTaken;
        TradeEntry entry = new TradeEntry(date, time, tradesTaken, contractCount, contractNames, runningTotal, storedScreenshot);
        trades.add(entry);
        appendRow(entry);
        saveTrades();
        resetForm();
    }

    private void resetForm() {
        tradesSpinner.setValue(1);
        contractCountSpinner.setValue(1);
        contractNamesField.setText("");
        selectedScreenshot = null;
        screenshotLabel.setText("No screenshot selected");
        totalTradesLabel.setText("Total trades recorded: " + runningTotal);
    }

    private void appendRow(TradeEntry entry) {
        tableModel.addRow(new Object[]{
                entry.date().format(DateTimeFormatter.ISO_DATE),
                entry.time().toString(),
                entry.tradesTaken(),
                entry.contractCount(),
                entry.contractNames(),
                entry.totalTrades(),
                entry.screenshotPath()
        });
    }

    private void selectScreenshot(ActionEvent event) {
        JFileChooser chooser = new JFileChooser();
        chooser.setDialogTitle("Select trade screenshot");
        chooser.setFileSelectionMode(JFileChooser.FILES_ONLY);
        chooser.setAcceptAllFileFilterUsed(false);
        chooser.addChoosableFileFilter(new javax.swing.filechooser.FileNameExtensionFilter("Images", "png", "jpg", "jpeg", "gif"));
        if (chooser.showOpenDialog(this) == JFileChooser.APPROVE_OPTION) {
            selectedScreenshot = chooser.getSelectedFile();
            screenshotLabel.setText(selectedScreenshot.getName());
        }
    }

    private Path storeScreenshot(File screenshot) throws IOException {
        Files.createDirectories(IMAGE_DIR);
        String extension = getExtension(screenshot.getName());
        String filename = "trade_" + System.currentTimeMillis() + (extension.isEmpty() ? ".png" : "." + extension);
        Path destination = IMAGE_DIR.resolve(filename);
        Files.copy(screenshot.toPath(), destination, StandardCopyOption.REPLACE_EXISTING);
        return destination;
    }

    private static String getExtension(String filename) {
        int index = filename.lastIndexOf('.');
        return index == -1 ? "" : filename.substring(index + 1);
    }

    private void saveTrades() {
        try (ObjectOutputStream output = new ObjectOutputStream(new FileOutputStream(DATA_FILE))) {
            output.writeObject(trades);
        } catch (IOException e) {
            JOptionPane.showMessageDialog(this, "Failed to save trades: " + e.getMessage(), "Save error", JOptionPane.ERROR_MESSAGE);
        }
    }

    @SuppressWarnings("unchecked")
    private void loadTrades() {
        if (!new File(DATA_FILE).exists()) {
            totalTradesLabel.setText("Total trades recorded: 0");
            return;
        }

        try (ObjectInputStream input = new ObjectInputStream(new FileInputStream(DATA_FILE))) {
            trades.clear();
            trades.addAll((List<TradeEntry>) input.readObject());
            tableModel.setRowCount(0);
            for (TradeEntry entry : trades) {
                appendRow(entry);
            }
            runningTotal = trades.isEmpty() ? 0 : trades.get(trades.size() - 1).totalTrades();
            totalTradesLabel.setText("Total trades recorded: " + runningTotal);
        } catch (IOException | ClassNotFoundException e) {
            JOptionPane.showMessageDialog(this, "Could not load saved trades: " + e.getMessage(), "Load error", JOptionPane.ERROR_MESSAGE);
        }
    }

    private static LocalDate toLocalDate(Date date) {
        return LocalDateTime.ofInstant(toInstant(date), ZoneId.systemDefault()).toLocalDate();
    }

    private static LocalTime toLocalTime(Date date) {
        return LocalDateTime.ofInstant(toInstant(date), ZoneId.systemDefault()).toLocalTime().withSecond(0).withNano(0);
    }

    private static Instant toInstant(Date date) {
        return date.toInstant();
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new TradingJournal().setVisible(true));
    }

    private record TradeEntry(LocalDate date, LocalTime time, int tradesTaken, int contractCount, String contractNames,
                              int totalTrades, String screenshotPath) implements Serializable {
    }

    private static class ScreenshotButtonRenderer extends JButton implements javax.swing.table.TableCellRenderer {
        @Override
        public Component getTableCellRendererComponent(JTable table, Object value, boolean isSelected, boolean hasFocus, int row, int column) {
            boolean hasImage = value != null && !value.toString().isEmpty();
            setText(hasImage ? "Open" : "No Image");
            setEnabled(hasImage);
            return this;
        }
    }

    private class ScreenshotButtonEditor extends AbstractCellEditor implements javax.swing.table.TableCellEditor, ActionListener {
        private final JButton button = new JButton();
        private String currentPath;

        @Override
        public Component getTableCellEditorComponent(JTable table, Object value, boolean isSelected, int row, int column) {
            currentPath = value == null ? "" : value.toString();
            button.setText(currentPath.isEmpty() ? "No Image" : "Open");
            button.setEnabled(!currentPath.isEmpty());
            button.addActionListener(this);
            return button;
        }

        @Override
        public Object getCellEditorValue() {
            return currentPath;
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            if (!currentPath.isEmpty()) {
                try {
                    Desktop.getDesktop().open(new File(currentPath));
                } catch (IOException ex) {
                    JOptionPane.showMessageDialog(TradingJournal.this, "Could not open screenshot: " + ex.getMessage(), "Open error", JOptionPane.ERROR_MESSAGE);
                }
            }
            fireEditingStopped();
        }
    }
}
